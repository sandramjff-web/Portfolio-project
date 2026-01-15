const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('minimap-canvas');
const miniCtx = miniCanvas.getContext('2d');

const statusText = document.getElementById('status-text');
const diffText = document.getElementById('diff-text');
const flockCountHud = document.getElementById('flock-count-hud');
const lockBtn = document.getElementById('lock-btn');
const feedBtn = document.getElementById('feed-btn');
const gameOverEl = document.getElementById('game-over');
const panel = document.getElementById('gameplay-controls');
const toggleBtn = document.getElementById('toggle-panel-btn');
const tips = document.getElementById('tips');

const WORLD_SIZE = 5000; 
const CELL_SIZE = 60; 
const COLS = Math.ceil(WORLD_SIZE / CELL_SIZE);
const ROWS = Math.ceil(WORLD_SIZE / CELL_SIZE);

let flock = [];
let predators = []; 
let survivor = null;
let habitats = []; 
let caves = []; 
let goal = { x: WORLD_SIZE - 400, y: WORLD_SIZE - 400, r: 150 };
let tempMarker = null; 
let obstacles = [];
let navGrid = []; 
let groundPattern = null;
let waypoints = []; // Array to store user-created waypoints

let globalPath = []; 
let pathIndex = 0;   
let smartTarget = { x: 0, y: 0 }; 
let flockState = "IDLE"; 
let isGameOver = false;
let globalSpeedMultiplier = 1.0; 
let isFlockScattered = false;
let isHunted = false;
let isLuring = false;
let isDraggingMap = false;
let lastMouse = { x: 0, y: 0 };
const camera = { x: 0, y: 0, zoom: 0.5, locked: true };

const DIFFICULTY_SETTINGS = {
    easy:   { wolfCount: 5,  wolvesHateRain: true,  wolvesEatBirds: false, clusters: 5,  scatter: 80 },
    medium: { wolfCount: 10, wolvesHateRain: true,  wolvesEatBirds: false, clusters: 8,  scatter: 120 },
    hard:   { wolfCount: 15, wolvesHateRain: false, wolvesEatBirds: true,  clusters: 10, scatter: 150 }
};

const DIFFICULTY_DESCRIPTIONS = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard'
};

// Difficulty tips for the floating text at bottom
const DIFFICULTY_TIPS = {
    easy: {
        title: 'Easy Mode:',
        content: [
            'Weather changes favor human survival.',
            'Wolves will return to caves to shelter from rain.',
            'Only 5 wolf patrols the area.',
            'Focus on gathering your flock and reaching the sanctuary.'
        ]
    },
    medium: {
        title: 'Medium Mode:',
        content: [
            'Weather affects movement but is manageable.',
            'Wolves are afraid of rain and will seek shelter.',
            '15 wolves roam the landscape.',
            'Use weather to your advantage and avoid direct confrontations.'
        ]
    },
    hard: {
        title: 'Hard Mode:',
        content: [
            'Weather is unpredictable and challenging.',
            'Wolves are aggressive regardless of weather conditions.',
            '20 wolves in frenzy mode will attack your flock.',
            'When you hide, wolves will target your birds instead!',
            'Press CALL to recall scattered flock members.'
        ]
    }
};

let currentDifficulty = 'medium';

// === Weather System (Integrated Cartoon Colors) ===
const WeatherSystem = {
    current: 'sunny', 
    speedModifier: 1.0,
    windForce: { x: 0, y: 0 },
    rainDrops: [],
    lightningTimer: 0,
    colors: {},

    updateColorPalette(type) {
        const palettes = {
            sunny: {
                bg: '#5c9e6e', ground1: '#66ad7a', ground2: '#528f63',
                trees: {
                    oak:   ['#2d6e32', '#419c48', '#1e4a21'],
                    pine:  ['#1a5c4e', '#298a76', '#0f3830'],
                    palm:  ['#8cb32f', '#aedb44', '#6a8a1f'],
                    round: ['#4caf50', '#81c784', '#388e3c']
                },
                shadow: 'rgba(0,0,0,0.2)'
            },
            rain: {
                bg: '#2f4f4f', ground1: '#3a6161', ground2: '#274242',
                trees: {
                    oak:   ['#224a3e', '#2f6656', '#163028'],
                    pine:  ['#153330', '#1f4d48', '#0b1c1a'],
                    palm:  ['#556b2f', '#728f3f', '#3b4a20'],
                    round: ['#2e8b57', '#3cb371', '#1e5c39']
                },
                shadow: 'rgba(0,0,0,0.3)'
            },
            wind: {
                bg: '#5d5d5d', ground1: '#6e6e6e', ground2: '#525252',
                trees: {
                    oak:   ['#4a5d4a', '#637d63', '#334033'],
                    pine:  ['#2f4f4f', '#447070', '#1f3333'],
                    palm:  ['#8fbc8f', '#aed1ae', '#6b8f6b'],
                    round: ['#556b2f', '#6b8e23', '#3b4a20']
                },
                shadow: 'rgba(0,0,0,0.25)'
            },
            storm: {
                bg: '#1a1a24', ground1: '#232330', ground2: '#13131a',
                trees: {
                    oak:   ['#1e2621', '#2c3830', '#111713'],
                    pine:  ['#141b21', '#1f2a33', '#0b0f12'],
                    palm:  ['#2f3326', '#454a37', '#1c1f16'],
                    round: ['#213326', '#314d39', '#141f17']
                },
                shadow: 'rgba(0,0,0,0.4)'
            }
        };
        this.colors = palettes[type];
        createGroundTexture(); 
    },

    init() {
        this.rainDrops = [];
        for(let i=0; i<300; i++) {
            this.rainDrops.push({ x: Math.random()*WORLD_SIZE, y: Math.random()*WORLD_SIZE, len: 15+Math.random()*20, speed: 15+Math.random()*10 });
        }
        this.setWeather('sunny'); 
    },

    setWeather(type) {
        this.current = type;
        this.updateColorPalette(type);
        switch(type) {
            case 'sunny': this.speedModifier=1.0; this.windForce={x:0,y:0}; break;
            case 'rain': this.speedModifier=0.6; this.windForce={x:0,y:0}; break;
            case 'wind': this.speedModifier=0.7; let a=Math.random()*6.28; this.windForce={x:Math.cos(a)*0.1,y:Math.sin(a)*0.1}; break;
            case 'storm': this.speedModifier=0.4; let b=Math.random()*6.28; this.windForce={x:Math.cos(b)*0.18,y:Math.sin(b)*0.18}; this.lightningTimer=100; break;
        }
    },

    update() {
        if(this.current === 'rain' || this.current === 'storm') {
            for(let d of this.rainDrops) {
                d.y += d.speed; d.x += this.windForce.x * 40; 
                if(d.y > WORLD_SIZE) { d.y = -50; d.x = Math.random() * WORLD_SIZE; }
                if(d.x > WORLD_SIZE) d.x = 0; if(d.x < 0) d.x = WORLD_SIZE;
            }
        }
        if(this.current === 'storm') {
            if(this.lightningTimer > 0) this.lightningTimer--;
            if(this.lightningTimer <= 0) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height); 
                this.lightningTimer = 200 + Math.random() * 300;
            }
        }
    },

    draw(ctx, l, r, t, b) {
        if(this.current === 'rain' || this.current === 'storm') {
            ctx.strokeStyle = this.current === 'storm' ? "rgba(220, 220, 255, 0.4)" : "rgba(180, 220, 255, 0.25)";
            ctx.lineWidth = 2; ctx.beginPath();
            for(let d of this.rainDrops) {
                if(d.x > l && d.x < r && d.y > t && d.y < b) {
                    ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + this.windForce.x*15, d.y + d.len);
                }
            }
            ctx.stroke();
        }
    }
};

function createGroundTexture() {
    const textureCanvas = document.createElement('canvas');
    const tSize = 400; textureCanvas.width = tSize; textureCanvas.height = tSize;
    const texCtx = textureCanvas.getContext('2d');
    texCtx.fillStyle = WeatherSystem.colors.bg; texCtx.fillRect(0, 0, tSize, tSize);
    for (let i = 0; i < 80; i++) {
        let x = Math.random() * tSize; let y = Math.random() * tSize;
        let s = 5 + Math.random() * 15; texCtx.fillStyle = WeatherSystem.colors.ground1;
        texCtx.beginPath(); texCtx.arc(x, y, s, 0, Math.PI*2); texCtx.fill();
    }
    groundPattern = ctx.createPattern(textureCanvas, 'repeat');
}

function drawCartoonTree(ctx, o) {
    const colors = WeatherSystem.colors.trees[o.type] || WeatherSystem.colors.trees['oak'];
    const baseColor = colors[0], lightColor = colors[1], shadowColor = colors[2];
    ctx.save(); ctx.translate(o.x, o.y);
    // Shadow
    ctx.fillStyle = WeatherSystem.colors.shadow; ctx.beginPath();
    ctx.ellipse(o.r*0.2, o.r*0.2, o.r, o.r*0.8, 0, 0, Math.PI*2); ctx.fill();

    switch(o.type) {
        case 'pine':
            ctx.fillStyle = baseColor; ctx.strokeStyle = '#0a1a1a'; ctx.lineWidth = 3;
            ctx.beginPath(); const spikes = 10;
            for(let i=0; i<spikes*2; i++) {
                let r = (i%2 === 0) ? o.r : o.r * 0.4;
                let a = (i / (spikes*2)) * Math.PI * 2 + o.seed;
                ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = lightColor; ctx.beginPath(); ctx.arc(0, 0, o.r * 0.3, 0, Math.PI*2); ctx.fill();
            break;
        case 'palm':
            ctx.fillStyle = baseColor; ctx.strokeStyle = '#1a2b0a'; ctx.lineWidth = 2;
            const leaves = 6;
            for(let i=0; i<leaves; i++) {
                ctx.save(); ctx.rotate((i/leaves)*Math.PI*2 + o.seed); ctx.beginPath();
                ctx.ellipse(o.r*0.6, 0, o.r*0.6, o.r*0.2, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = lightColor; ctx.beginPath(); ctx.ellipse(o.r*0.6, 0, o.r*0.4, o.r*0.05, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
            }
            ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(0, 0, o.r*0.2, 0, Math.PI*2); ctx.fill();
            break;
        case 'round':
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, o.r + 3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = baseColor; ctx.beginPath(); ctx.arc(0, 0, o.r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = shadowColor; ctx.beginPath(); ctx.arc(0, 0, o.r, 0.5, 2.5); ctx.fill();
            ctx.fillStyle = lightColor; ctx.beginPath(); ctx.ellipse(-o.r*0.3, -o.r*0.3, o.r*0.25, o.r*0.15, -0.7, 0, Math.PI*2); ctx.fill();
            break;
        default: // oak
            const puffs = 6; ctx.fillStyle = baseColor; ctx.strokeStyle = '#1a2b1a'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, o.r*0.6, 0, Math.PI*2);
            for(let i=0; i<puffs; i++) {
                let a = (i/puffs)*Math.PI*2 + o.seed; let d = o.r * 0.5;
                ctx.arc(Math.cos(a)*d, Math.sin(a)*d, o.r*0.4, 0, Math.PI*2);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = lightColor; ctx.beginPath(); ctx.arc(-o.r*0.3, -o.r*0.3, o.r*0.2, 0, Math.PI*2); ctx.fill();
            break;
    }
    ctx.restore();
}

// === Spatial Hash for obstacles ===
let obstacleGrid = {};
const OBSTACLE_CELL = 200; // Larger cells for obstacle spatial hash

function buildObstacleGrid() {
    obstacleGrid = {};
    for (let o of obstacles) {
        // Add obstacle to all cells it could affect (considering its radius + margin)
        const margin = o.r + CELL_SIZE / 2 + 20;
        const minC = Math.floor((o.x - margin) / OBSTACLE_CELL);
        const maxC = Math.floor((o.x + margin) / OBSTACLE_CELL);
        const minR = Math.floor((o.y - margin) / OBSTACLE_CELL);
        const maxR = Math.floor((o.y + margin) / OBSTACLE_CELL);

        for (let c = minC; c <= maxC; c++) {
            for (let r = minR; r <= maxR; r++) {
                const key = `${c},${r}`;
                if (!obstacleGrid[key]) obstacleGrid[key] = [];
                obstacleGrid[key].push(o);
            }
        }
    }
}

function getNearbyObstacles(x, y) {
    const c = Math.floor(x / OBSTACLE_CELL);
    const r = Math.floor(y / OBSTACLE_CELL);
    return obstacleGrid[`${c},${r}`] || [];
}

// === Pathfinder Class (Optimized) ===
class Pathfinder {
    constructor() { this.lastCalcTime = 0; }
    bakeNavMesh() {
        buildObstacleGrid(); // Build spatial hash first
        navGrid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(true));
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                let wx = c * CELL_SIZE + CELL_SIZE / 2;
                let wy = r * CELL_SIZE + CELL_SIZE / 2;
                let safe = true;
                // Only check nearby obstacles using spatial hash
                const nearby = getNearbyObstacles(wx, wy);
                for (let o of nearby) {
                    const dx = wx - o.x, dy = wy - o.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = o.r + CELL_SIZE / 2 + 20;
                    if (distSq < minDist * minDist) { safe = false; break; }
                }
                navGrid[c][r] = safe;
            }
        }
    }
    toGrid(pos) { return { c: Math.floor(pos.x / CELL_SIZE), r: Math.floor(pos.y / CELL_SIZE) }; }

    // Binary insert to keep openSet sorted (much faster than sorting every iteration)
    insertSorted(arr, node) {
        let low = 0, high = arr.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (arr[mid].f < node.f) low = mid + 1;
            else high = mid;
        }
        arr.splice(low, 0, node);
    }

    findPath(startPos, endPos) {
        let startNode = this.toGrid(startPos);
        let endNode = this.toGrid(endPos);
        if (startNode.c < 0 || startNode.c >= COLS || startNode.r < 0 || startNode.r >= ROWS) return [];

        // Find valid end node if needed
        if (endNode.c < 0 || endNode.c >= COLS || endNode.r < 0 || endNode.r >= ROWS || !navGrid[endNode.c]?.[endNode.r]) {
            let found = false;
            for (let searchRad = 1; searchRad < 15 && !found; searchRad++) {
                for (let i = -searchRad; i <= searchRad && !found; i++) {
                    for (let j = -searchRad; j <= searchRad && !found; j++) {
                        let nc = endNode.c + i, nr = endNode.r + j;
                        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && navGrid[nc][nr]) {
                            endNode = { c: nc, r: nr };
                            found = true;
                        }
                    }
                }
            }
        }

        let openSet = [];
        let openSetMap = new Map(); // Fast lookup for existing nodes
        let closedSet = new Set();
        let cameFrom = {};
        let gScore = {};

        let startKey = `${startNode.c},${startNode.r}`;
        gScore[startKey] = 0;
        let startF = Math.abs(startNode.c - endNode.c) + Math.abs(startNode.r - endNode.r);
        openSet.push({ c: startNode.c, r: startNode.r, f: startF });
        openSetMap.set(startKey, true);

        const neighbors = [
            { dc: 0, dr: -1, cost: 1 }, { dc: 0, dr: 1, cost: 1 },
            { dc: -1, dr: 0, cost: 1 }, { dc: 1, dr: 0, cost: 1 },
            { dc: -1, dr: -1, cost: 1.4 }, { dc: 1, dr: -1, cost: 1.4 },
            { dc: -1, dr: 1, cost: 1.4 }, { dc: 1, dr: 1, cost: 1.4 }
        ];

        let loops = 0;
        while (openSet.length > 0) {
            loops++;
            if (loops > 8000) return null;

            let current = openSet.shift(); // Already sorted, just take first
            let currentKey = `${current.c},${current.r}`;
            openSetMap.delete(currentKey);

            if (current.c === endNode.c && current.r === endNode.r) {
                return this.reconstructPath(cameFrom, current, endPos);
            }

            closedSet.add(currentKey);

            for (let n of neighbors) {
                let nc = current.c + n.dc, nr = current.r + n.dr;
                if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
                if (!navGrid[nc][nr]) continue;

                let nKey = `${nc},${nr}`;
                if (closedSet.has(nKey)) continue;

                let tentativeG = gScore[currentKey] + n.cost;
                if (tentativeG < (gScore[nKey] || Infinity)) {
                    cameFrom[nKey] = current;
                    gScore[nKey] = tentativeG;
                    let f = tentativeG + Math.abs(nc - endNode.c) + Math.abs(nr - endNode.r);

                    if (!openSetMap.has(nKey)) {
                        this.insertSorted(openSet, { c: nc, r: nr, f: f });
                        openSetMap.set(nKey, true);
                    }
                }
            }
        }
        return null;
    }
    reconstructPath(cameFrom, current, realEndPos) {
        let path = []; let currKey = `${current.c},${current.r}`;
        while(cameFrom[currKey]) {
            path.unshift({ x: current.c * CELL_SIZE + CELL_SIZE/2, y: current.r * CELL_SIZE + CELL_SIZE/2 });
            current = cameFrom[currKey]; currKey = `${current.c},${current.r}`;
        }
        if(path.length > 0) path[path.length-1] = realEndPos; 
        return path;
    }
}
const pathfinder = new Pathfinder();

let boidGrid = {};
function updateBoidGrid() {
    boidGrid = {};
    for(let i=0; i<flock.length; i++) {
        let b = flock[i];
        let col = Math.floor(b.pos.x/100); let row = Math.floor(b.pos.y/100);
        let key = `${col},${row}`;
        if(!boidGrid[key]) boidGrid[key] = [];
        boidGrid[key].push(i);
    }
}

function getActiveHabitats() {
    // Only return active speed habitats, not shield habitats
    return habitats.filter(h => h.active && h.type === 'speed');
}

function getBestHabitatOrder(startPos, habitats) {
    // Only consider speed habitats, filter out shield habitats
    const remaining = [...habitats.filter(h => h.type === 'speed')];
    const order = [];
    let currentPos = startPos;
    
    while (remaining.length > 0) {
        let nearestHabitat = null;
        let minDist = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
            const h = remaining[i];
            const dist = Math.hypot(h.x - currentPos.x, h.y - currentPos.y);
            
            if (dist < minDist) {
                minDist = dist;
                nearestHabitat = i;
            }
        }
        
        if (nearestHabitat !== null) {
            order.push(remaining[nearestHabitat]);
            currentPos = { x: remaining[nearestHabitat].x, y: remaining[nearestHabitat].y };
            remaining.splice(nearestHabitat, 1);
        } else {
            break;
        }
    }
    
    return order;
}

function generatePathThroughHabitats(startPos, endPos, habitats) {
    // Only use speed habitats, filter out shield habitats
    const speedHabitats = habitats.filter(h => h.type === 'speed');
    
    if (speedHabitats.length === 0) {
        return pathfinder.findPath(startPos, endPos);
    }
    
    let fullPath = [];
    let currentPos = startPos;
    
    for (const h of speedHabitats) {
        // Generate path from current position to the exact center of the habitat
        const path = pathfinder.findPath(currentPos, h);
        if (path && path.length > 0) {
            // Include all points including the habitat center
            fullPath = fullPath.concat(path);
            // Set current position to the habitat center
            currentPos = { ...h };
        }
    }
    
    // Generate path from the last habitat center to the final destination
    const finalPath = pathfinder.findPath(currentPos, endPos);
    if (finalPath && finalPath.length > 0) {
        // Skip the first point if it's the same as the last point in fullPath
        const startIndex = (fullPath.length > 0 && 
                           Math.hypot(fullPath[fullPath.length-1].x - finalPath[0].x, 
                                      fullPath[fullPath.length-1].y - finalPath[0].y) < 1) ? 1 : 0;
        fullPath = fullPath.concat(finalPath.slice(startIndex));
    }
    
    return fullPath;
}

function updateAI() {
    if(!survivor.active) return;
    let finalDest = goal; // Always use the fixed goal as final destination
    
    // Check if we need to regenerate path
    let shouldRegeneratePath = globalPath.length === 0 || Date.now() % 60 === 0;
    
    if (shouldRegeneratePath) {
        // Get all active habitats
        const activeHabitats = getActiveHabitats();
        
        // Combine speed habitats and waypoints into a single path point collection
        let allPathPoints = [];
        
        // Add speed habitats to the path points collection
        allPathPoints = allPathPoints.concat(activeHabitats);
        
        // Add waypoints to the path points collection
        allPathPoints = allPathPoints.concat(waypoints);
        
        // Generate path that goes through all path points (sorted by distance) and finally to the goal
    let newPath = [];
    let currentPos = survivor.pos;
    
    // If there are path points, generate path through them in distance order
    if (allPathPoints.length > 0) {
        // Sort path points by distance from current position
        allPathPoints.sort((a, b) => {
            const distA = Math.hypot(a.x - currentPos.x, a.y - currentPos.y);
            const distB = Math.hypot(b.x - currentPos.x, b.y - currentPos.y);
            return distA - distB;
        });
        
        for (const pp of allPathPoints) {
            // Generate path to this path point
            let segmentPath = pathfinder.findPath(currentPos, pp);
            
            if (segmentPath && segmentPath.length > 0) {
                newPath = newPath.concat(newPath.length > 0 ? segmentPath.slice(1) : segmentPath);
                
                // 为每个路径点添加额外的路径点，确保survivor穿过目标区域
                // 1. 添加当前路径点作为关键目标
                newPath.push(pp);
                
                // 2. 如果是栖息地，添加栖息地对面边缘的额外路径点
                if (pp.type === 'speed') {
                    // 计算从当前位置到栖息地中心的方向
                    const dx = pp.x - currentPos.x;
                    const dy = pp.y - currentPos.y;
                    const dist = Math.hypot(dx, dy);
                    
                    // 计算穿过栖息地中心后的延长点（超出栖息地半径）
                    const extensionFactor = 1.5; // 延长50%
                    const extendedX = pp.x + (dx / dist) * pp.r * extensionFactor;
                    const extendedY = pp.y + (dy / dist) * pp.r * extensionFactor;
                    
                    // 添加延长点作为额外路径点
                    newPath.push({ x: extendedX, y: extendedY });
                }
                
                currentPos = pp;
            }
        }
        
        // Generate final path from last path point to goal
        let finalSegment = pathfinder.findPath(currentPos, finalDest);
        
        if (finalSegment && finalSegment.length > 0) {
            newPath = newPath.concat(newPath.length > 0 ? finalSegment.slice(1) : finalSegment);
        }
    } else {
        // No path points, generate normal path to goal
        let directPath = pathfinder.findPath(survivor.pos, finalDest);
        if (directPath && directPath.length > 0) {
            newPath = directPath;
        }
    }
        
        if(newPath && newPath.length > 0) {
            globalPath = newPath;
            pathIndex = 0;
        }
    }
    
    let pathPoint = finalDest;
    if(globalPath.length > 0) {
        for(let i = pathIndex; i < globalPath.length; i++) {
            let d = Math.hypot(globalPath[i].x - survivor.pos.x, globalPath[i].y - survivor.pos.y);
            if(d < 70) pathIndex = i + 1; else break; 
        }
        if(pathIndex >= globalPath.length) pathIndex = globalPath.length - 1;
        pathPoint = globalPath[pathIndex];
    }
    
    // Remove waypoints that have been reached
    for (let i = waypoints.length - 1; i >= 0; i--) {
        const wp = waypoints[i];
        const dist = Math.hypot(survivor.pos.x - wp.x, survivor.pos.y - wp.y);
        if (dist < wp.r) {
            waypoints.splice(i, 1);
            globalPath = []; // Reset path to regenerate with remaining waypoints
            break;
        }
    }
    
    let threatDist = Infinity;
    if (predators.length > 0) {
        for(let p of predators) {
            if (p.state === 'hunting') {
                let d = Math.hypot(p.pos.x - survivor.pos.x, p.pos.y - survivor.pos.y);
                if(d < threatDist) threatDist = d;
            }
        }
    }
    isHunted = threatDist < 700;
    let distToPoint = Math.hypot(pathPoint.x - survivor.pos.x, pathPoint.y - survivor.pos.y);
    const FETCH_THRESHOLD = 600 * globalSpeedMultiplier; const REGNOUP_THRESHOLD = 250; 
    if (isFlockScattered) { statusText.innerText = "SCATTERED!"; statusText.style.color = "#ff3333"; }
    else if (survivor.invincible) { statusText.innerText = "HIDING"; statusText.style.color = "#ffd700"; }
    else if(threatDist < 500) { statusText.innerText = "HUNTED!"; statusText.style.color = "#ff3333"; }
    else if (flockState === "GUIDING") { statusText.innerText = "MOVING"; statusText.style.color = "#4ade80"; if (distToPoint > FETCH_THRESHOLD) flockState = "FETCHING"; }
    else if (flockState === "FETCHING") { statusText.innerText = "WAITING"; statusText.style.color = "#ffff00"; if (distToPoint < REGNOUP_THRESHOLD) flockState = "GUIDING"; }
    else { flockState = "GUIDING"; }
    if (flockState === "FETCHING") {
        let angle = Math.atan2(pathPoint.y - survivor.pos.y, pathPoint.x - survivor.pos.x);
        smartTarget = { x: survivor.pos.x + Math.cos(angle) * 180, y: survivor.pos.y + Math.sin(angle) * 180 };
    } else { smartTarget = pathPoint; }
}

class Predator {
    constructor(x, y) {
        this.pos = { x: x || Math.random()*WORLD_SIZE, y: y || Math.random()*WORLD_SIZE };
        
        // Ensure the wolf's spawn position doesn't overlap with obstacles and is far enough from the survivor
        let maxAttempts = 100;
        let attempts = 0;
        let validPosition = false;
        
        while (!validPosition && attempts < maxAttempts) {
            attempts++;
            
            // Reset position
            if (!x) {
                this.pos = { x: Math.random()*WORLD_SIZE, y: Math.random()*WORLD_SIZE };
            }
            
            // Check for overlap with obstacles
            let overlappingObstacle = false;
            for (let o of obstacles) {
                if (Math.hypot(this.pos.x - o.x, this.pos.y - o.y) < o.r + 100) {
                    overlappingObstacle = true;
                    break;
                }
            }
            
            // Check if far enough from survivor
            let farFromSurvivor = true;
            if (!x && survivor) {
                farFromSurvivor = Math.hypot(this.pos.x - survivor.pos.x, this.pos.y - survivor.pos.y) >= 800;
            }
            
            // Check for overlap with other wolves
            let overlappingWolf = false;
            for (let p of predators) {
                if (p !== this && Math.hypot(this.pos.x - p.pos.x, this.pos.y - p.pos.y) < this.r + p.r + 20) {
                    overlappingWolf = true;
                    break;
                }
            }
            
            validPosition = !overlappingObstacle && farFromSurvivor && !overlappingWolf;
        }
        
        this.vel = { x: 1, y: 1 }; this.baseSpeed = 4.0; 
        this.wanderTheta = Math.random() * Math.PI * 2;
        this.r = 25; this.aura = 280; this.killRadius = 40; this.huntingRange = 400; this.state = 'wandering'; 
    }
    update() {
        if(isGameOver) return;
        let settings = DIFFICULTY_SETTINGS[currentDifficulty];
        let isRaining = (WeatherSystem.current === 'rain' || WeatherSystem.current === 'storm');
        this.state = 'wandering'; 
        if (settings.wolvesHateRain && isRaining) {
            this.state = 'hiding';
            let nearestCave = null; let minDist = Infinity;
            for(let c of caves) {
                let d = Math.hypot(this.pos.x - c.x, this.pos.y - c.y);
                if(d < minDist) { minDist = d; nearestCave = c; }
            }
            if(nearestCave) {
                if (minDist < nearestCave.r) { this.vel.x *= 0.1; this.vel.y *= 0.1; return; }
                let ang = Math.atan2(nearestCave.y - this.pos.y, nearestCave.x - this.pos.x);
                this.vel.x += Math.cos(ang) * 0.5; this.vel.y += Math.sin(ang) * 0.5;
            }
        } else {
            let target = null;
            if (survivor.active && !survivor.invincible) {
                let d = Math.hypot(this.pos.x - survivor.pos.x, this.pos.y - survivor.pos.y);
                if (d < this.huntingRange) target = survivor;
            }
            if (settings.wolvesEatBirds && !target && !isFlockScattered && survivor.invincible) {
                let nearestBirdDist = this.huntingRange;
                for(let i=0; i<Math.min(flock.length, 50); i++) { 
                    let b = flock[i]; let d = Math.hypot(this.pos.x - b.pos.x, this.pos.y - b.pos.y);
                    if (d < nearestBirdDist) { nearestBirdDist = d; target = b; }
                }
            }
            if (target) {
                this.state = 'hunting';
                let ang = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
                this.vel.x += Math.cos(ang) * 0.25; this.vel.y += Math.sin(ang) * 0.25;
                if (Math.hypot(this.pos.x - target.pos.x, this.pos.y - target.pos.y) < this.killRadius) {
                    if (target === survivor) triggerDeath(); else scatterFlock();
                }
            } else {
                this.wanderTheta += (Math.random() - 0.5) * 0.2;
                this.vel.x += Math.cos(this.wanderTheta) * 0.1; this.vel.y += Math.sin(this.wanderTheta) * 0.1;
            }
        }
        let s = Math.hypot(this.vel.x, this.vel.y);
        let speedMod = 1.0; if (settings.wolvesHateRain && WeatherSystem.current !== 'sunny') speedMod = WeatherSystem.speedModifier; 
        let actualSpeed = (this.state === 'hunting' ? this.baseSpeed * 1.3 : this.baseSpeed) * speedMod;
        if(s > 0) { this.vel.x = (this.vel.x / s) * actualSpeed; this.vel.y = (this.vel.y / s) * actualSpeed; }
        let nextX = this.pos.x + this.vel.x; let nextY = this.pos.y + this.vel.y; let hit = false;
        if(nextX < 0 || nextX > WORLD_SIZE) { this.vel.x *= -1; hit = true; }
        if(nextY < 0 || nextY > WORLD_SIZE) { this.vel.y *= -1; hit = true; }
        for(let o of obstacles) {
            let d = Math.hypot(nextX - o.x, nextY - o.y);
            if(d < o.r + this.r + 5) {
                let angle = Math.atan2(nextY - o.y, nextX - o.x);
                this.vel.x = Math.cos(angle) * actualSpeed; this.vel.y = Math.sin(angle) * actualSpeed;
                this.wanderTheta = angle; hit = true; break;
            }
        }
        if(!hit) { this.pos.x += this.vel.x; this.pos.y += this.vel.y; }
    }
    draw(ctx) {
        ctx.save();
        if (this.state === 'hunting') {
            ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.huntingRange, 0, Math.PI*2);
            ctx.fillStyle = "rgba(255, 50, 50, 0.05)"; ctx.fill();
        }
        ctx.fillStyle = "#ff2222"; ctx.shadowBlur = 15; ctx.shadowColor = "#ff0000";
        ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(this.pos.x + this.vel.x*3, this.pos.y + this.vel.y*3, 8, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Survivor {
    constructor() { 
        this.pos = { x: 300, y: 300 }; 
        this.vel = { x: 0, y: 0 }; 
        this.baseSpeed = 4.0; 
        this.size = 14; 
        this.active = true; 
        this.boostTimer = 0; 
        this.invincible = false; 
        this.hidingTimer = 0; 
        this.currentShieldHabitat = null; // Track current shield habitat
        // Load survivor image
        this.image = new Image();
        this.image.src = 'Layla_2025-9-19.png';
    }
    update() {
        if(!this.active) return;
        let isChased = false; let nearestThreat = Infinity;
        for(let p of predators) { if (p.state === 'hunting') { let d = Math.hypot(p.pos.x - this.pos.x, p.pos.y - this.pos.y); if (d < nearestThreat) nearestThreat = d; } }
        if (nearestThreat < 500) isChased = true;
        let insideSanctuary = false; let nearestSanctuary = null; let sanctuaryDist = Infinity;
        let foundShieldHabitat = null;
        
        // Check all habitats
        for(let h of habitats) {
            let d = Math.hypot(this.pos.x - h.x, this.pos.y - h.y);
            if(h.type === 'shield') {
                if (d < h.r) { 
                    insideSanctuary = true; 
                    foundShieldHabitat = h; 
                }
                if (d < sanctuaryDist) { sanctuaryDist = d; nearestSanctuary = h; }
            }
            else if(h.type === 'speed' && h.active && d < h.r) { activateHabitat(h); this.boostTimer = 180; }
        }
        
        // Handle shield habitat entry/exit
        if (insideSanctuary) {
            this.invincible = true; 
            this.hidingTimer++; 
            this.currentShieldHabitat = foundShieldHabitat;
            if (this.hidingTimer < 300) { 
                // Only stop if not being hunted
                if (!isChased) {
                    this.vel.x = 0; this.vel.y = 0; return; 
                }
            }
        } 
        else {
            // If we were in a shield habitat and now we're not, remove it
            if (this.currentShieldHabitat) {
                // Remove the habitat from the array
                const habitatIndex = habitats.indexOf(this.currentShieldHabitat);
                if (habitatIndex > -1) {
                    habitats.splice(habitatIndex, 1);
                    // Regenerate path since habitats have changed
                    globalPath = [];
                    pathIndex = 0;
                }
                this.currentShieldHabitat = null;
            }
            this.invincible = false; 
            this.hidingTimer = 0; 
        }
        let currentSpeed = this.baseSpeed * globalSpeedMultiplier * WeatherSystem.speedModifier;
        if(this.boostTimer > 0) { currentSpeed *= 1.5; this.boostTimer--; }
        let birdForce = {x:0, y:0}; let sanctuaryForce = {x:0, y:0}; let pathForce = {x:0, y:0};
        let fleeForce = {x:0, y:0};
        
        // Calculate force towards path target (highest priority)
        let dxToTarget = smartTarget.x - this.pos.x;
        let dyToTarget = smartTarget.y - this.pos.y;
        let distToTarget = Math.hypot(dxToTarget, dyToTarget);
        if (distToTarget > 0) {
            pathForce.x = (dxToTarget / distToTarget) * currentSpeed * 1.5; // Highest priority
            pathForce.y = (dyToTarget / distToTarget) * currentSpeed * 1.5;
            // pathForce.x = dxToTarget * currentSpeed / 100; // Highest priority
            // pathForce.y = dyToTarget * currentSpeed / 100;
        }
        
        if (isChased && !insideSanctuary && nearestSanctuary) {
            let dx = nearestSanctuary.x - this.pos.x; let dy = nearestSanctuary.y - this.pos.y;
            let d = Math.hypot(dx, dy); sanctuaryForce.x = (dx/d) * currentSpeed * 2.0; sanctuaryForce.y = (dy/d) * currentSpeed * 2.0; // Reduce sanctuary force weight
        } else if (!isFlockScattered) {
            let count = 0;
            for(let b of flock) { if(b.tamed) { let dx = b.pos.x - this.pos.x; let dy = b.pos.y - this.pos.y; if(Math.hypot(dx, dy) < 600) { birdForce.x += dx; birdForce.y += dy; count++; } } }
            if(count > 10) {
                let mag = Math.hypot(birdForce.x, birdForce.y);
                if (mag > 50) { birdForce.x = (birdForce.x / mag) * currentSpeed; birdForce.y = (birdForce.y / mag) * currentSpeed; }
            }
        }
        
        // Add flee force when hunted
        if (isChased) {
            // Find closest predator that is hunting
            let closestPredator = null;
            let closestDist = Infinity;
            for(let p of predators) {
                if (p.state === 'hunting') {
                    let d = Math.hypot(p.pos.x - this.pos.x, p.pos.y - this.pos.y);
                    if (d < closestDist) {
                        closestDist = d;
                        closestPredator = p;
                    }
                }
            }
            
            if (closestPredator) {
                // Calculate force away from predator
                let dx = this.pos.x - closestPredator.pos.x;
                let dy = this.pos.y - closestPredator.pos.y;
                let d = Math.hypot(dx, dy);
                if (d > 0) {
                    // Strong flee force when hunted
                    fleeForce.x = (dx / d) * currentSpeed * 2.5;
                    fleeForce.y = (dy / d) * currentSpeed * 2.5;
                }
            }
        }
        
        // Combine all forces, ensuring path force has highest priority
        if (isChased) {
            // When chased, flee force has highest priority
            this.vel.x += (fleeForce.x * 1.5 + pathForce.x * 0.8 + birdForce.x * 0.3 + sanctuaryForce.x * 0.9 - this.vel.x) * 0.15;
            this.vel.y += (fleeForce.y * 1.5 + pathForce.y * 0.8 + birdForce.y * 0.3 + sanctuaryForce.y * 0.9 - this.vel.y) * 0.15;
        } else {
            this.vel.x += (pathForce.x * 1.2 + birdForce.x * 0.3 + sanctuaryForce.x * 0.9 - this.vel.x) * 0.1;
            this.vel.y += (pathForce.y * 1.2 + birdForce.y * 0.3 + sanctuaryForce.y * 0.9 - this.vel.y) * 0.1;
        }
        this.vel.x += WeatherSystem.windForce.x; this.vel.y += WeatherSystem.windForce.y;
        let nextX, nextY;
        if (isHunted || isChased) {
            nextX = this.pos.x + this.vel.x * 1.5; nextY = this.pos.y + this.vel.y * 1.5;
        } else {
            nextX = this.pos.x + this.vel.x; nextY = this.pos.y + this.vel.y;
        }
        // Check for obstacles
        for (let o of obstacles) {
            let dx = nextX - o.x; let dy = nextY - o.y; let d = Math.hypot(dx, dy); let minD = o.r + this.size + 2; 
            if (d < minD) { let angle = Math.atan2(dy, dx); nextX = o.x + Math.cos(angle) * minD; nextY = o.y + Math.sin(angle) * minD; this.vel.x *= 0.7; this.vel.y *= 0.7; }
        }
        this.pos.x = nextX; this.pos.y = nextY;
        
        // Boundary check - keep survivor within map boundaries
        if (this.pos.x < 0) {
            this.pos.x = 0;
            this.vel.x *= -0.5; // Bounce back
        } else if (this.pos.x > WORLD_SIZE) {
            this.pos.x = WORLD_SIZE;
            this.vel.x *= -0.5;
        }
        
        if (this.pos.y < 0) {
            this.pos.y = 0;
            this.vel.y *= -0.5;
        } else if (this.pos.y > WORLD_SIZE) {
            this.pos.y = WORLD_SIZE;
            this.vel.y *= -0.5;
        }
        
        // Ensure minimum speed when hunted
        if (isChased) {
            let currentSpeed = Math.hypot(this.vel.x, this.vel.y);
            let minSpeed = this.baseSpeed * 0.8;
            if (currentSpeed < minSpeed) {
                let angle = Math.atan2(this.vel.y, this.vel.x);
                if (isNaN(angle)) angle = Math.random() * Math.PI * 2;
                this.vel.x = Math.cos(angle) * minSpeed;
                this.vel.y = Math.sin(angle) * minSpeed;
            }
        }
        
        if(!isGameOver) { let gdx = this.pos.x - goal.x; let gdy = this.pos.y - goal.y; if(gdx*gdx + gdy*gdy < goal.r*goal.r) { isGameOver = true; this.active = false; setTimeout(() => { showRestartScreen('Victory!'); }, 50); } }
    }
    draw(ctx) {
        if(this.invincible) {
            ctx.save(); ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.size + 15, 0, Math.PI*2); ctx.fillStyle = "rgba(255, 215, 0, 0.3)"; ctx.fill(); ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 2; ctx.stroke(); 
            if (this.hidingTimer < 300) { ctx.fillStyle = "#fff"; ctx.font = "12px Arial"; ctx.textAlign = "center"; ctx.fillText(((300 - this.hidingTimer)/60).toFixed(1) + "s", this.pos.x, this.pos.y - 25); }
            ctx.restore();
        }
        // Draw survivor image instead of circle
        if(this.image.complete) {
            const imgSize = this.size * 4; // Adjust size multiplier as needed
            ctx.drawImage(this.image, this.pos.x - imgSize/2, this.pos.y - imgSize/2, imgSize, imgSize);
        } else {
            // Fallback to circle if image not loaded yet
            ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI*2); ctx.fill();
        }
    }
}

class Boid {
    constructor(startX, startY) {
        this.pos = { x: startX || Math.random()*WORLD_SIZE, y: startY || Math.random()*WORLD_SIZE };
        let a = Math.random()*Math.PI*2; this.vel = { x: Math.cos(a), y: Math.sin(a) }; this.acc = { x: 0, y: 0 };
        this.tamed = !!startX; this.baseMaxSpeed = 9.0; this.maxForce = 0.6; this.panicked = false; 
    }
    update() {
        if (isFlockScattered) return; 
        if (!this.tamed && isLuring && Math.hypot(survivor.pos.x - this.pos.x, survivor.pos.y - this.pos.y) < 600) this.tamed = true;
        this.applyBehaviors(); 
        this.acc.x += WeatherSystem.windForce.x; this.acc.y += WeatherSystem.windForce.y;
        this.vel.x += this.acc.x; this.vel.y += this.acc.y;
        let currentMaxSpeed = this.baseMaxSpeed * globalSpeedMultiplier * WeatherSystem.speedModifier;
        if(survivor.boostTimer > 0) currentMaxSpeed *= 1.3; if(this.panicked) currentMaxSpeed *= 1.4; 
        let speed = Math.hypot(this.vel.x, this.vel.y);
        if(speed > currentMaxSpeed) { this.vel.x = (this.vel.x/speed)*currentMaxSpeed; this.vel.y = (this.vel.y/speed)*currentMaxSpeed; }
        this.pos.x += this.vel.x; this.pos.y += this.vel.y; this.acc.x = 0; this.acc.y = 0;
        
        // Boundary check - keep flock within map boundaries
        if (this.pos.x < 0) {
            this.pos.x = 0;
            this.vel.x *= -0.5; // Bounce back
        } else if (this.pos.x > WORLD_SIZE) {
            this.pos.x = WORLD_SIZE;
            this.vel.x *= -0.5;
        }
        
        if (this.pos.y < 0) {
            this.pos.y = 0;
            this.vel.y *= -0.5;
        } else if (this.pos.y > WORLD_SIZE) {
            this.pos.y = WORLD_SIZE;
            this.vel.y *= -0.5;
        }
    }
    applyBehaviors() {
        let sW = parseFloat(document.getElementById('sepSlider').value), aW = parseFloat(document.getElementById('aliSlider').value), cW = parseFloat(document.getElementById('cohSlider').value);
        let seekForce = this.seek(smartTarget), flockForce = this.flock(sW, aW, cW);
        let avoidForce = {x:0, y:0}, fearForce = {x:0, y:0};
        this.panicked = false; let settings = DIFFICULTY_SETTINGS[currentDifficulty];
        if (settings.wolvesEatBirds && survivor.invincible) {
            for(let p of predators) {
                let d = Math.hypot(this.pos.x - p.pos.x, this.pos.y - p.pos.y);
                if(d < p.aura) { this.panicked = true; let strength = (p.aura - d) / 50; fearForce.x += (this.pos.x - p.pos.x)/d * strength * 8.0; fearForce.y += (this.pos.y - p.pos.y)/d * strength * 8.0; }
            }
        }
        if (isLuring && !this.tamed) { let dx = survivor.pos.x - this.pos.x; let dy = survivor.pos.y - this.pos.y; let d = Math.hypot(dx, dy); if (d < 800) { this.acc.x += (dx/d) * 1.5; this.acc.y += (dy/d) * 1.5; } }
        for(let o of obstacles) {
            let dx = this.pos.x - o.x; let dy = this.pos.y - o.y; let d = Math.hypot(dx, dy); let safeDist = o.r + 50; 
            if(d < safeDist) { let strength = (safeDist - d) / 50; avoidForce.x += (dx/d) * strength * 5.0; avoidForce.y += (dy/d) * strength * 5.0; }
        }
        if(this.panicked) { this.acc.x += fearForce.x + avoidForce.x * 2.0 + flockForce.x * 0.5; this.acc.y += fearForce.y + avoidForce.y * 2.0 + flockForce.y * 0.5; }
        else if (this.tamed) {
            if(flockState === "FETCHING") { this.acc.x += seekForce.x * 1.5 + flockForce.x * 2.0 + avoidForce.x; this.acc.y += seekForce.y * 1.5 + flockForce.y * 2.0 + avoidForce.y; }
            else { this.acc.x += seekForce.x * 1.2 + flockForce.x * 1.0 + avoidForce.x; this.acc.y += seekForce.y * 1.2 + flockForce.y * 1.0 + avoidForce.y; }
        } else { this.acc.x += flockForce.x + avoidForce.x; this.acc.y += flockForce.y + avoidForce.y; this.wander(); }
    }
    seek(target) {
        let dx = target.x - this.pos.x; let dy = target.y - this.pos.y; let d = Math.hypot(dx, dy);
        let currentMaxSpeed = this.baseMaxSpeed * globalSpeedMultiplier * WeatherSystem.speedModifier; 
        let desiredSpeed = currentMaxSpeed; if (d < 100) desiredSpeed = (d/100) * currentMaxSpeed;
        let sx = 0, sy = 0; if (d > 0) { dx = (dx/d) * desiredSpeed; dy = (dy/d) * desiredSpeed; sx = dx - this.vel.x; sy = dy - this.vel.y; }
        let len = Math.hypot(sx, sy); if(len > this.maxForce) { sx=(sx/len)*this.maxForce; sy=(sy/len)*this.maxForce; }
        return {x:sx, y:sy};
    }
    wander() { this.acc.x += (Math.random()-0.5)*0.5; this.acc.y += (Math.random()-0.5)*0.5; }
    flock(sW, aW, cW) {
        let sep = {x:0, y:0}, ali = {x:0, y:0}, coh = {x:0, y:0}; let count = 0;
        let col = Math.floor(this.pos.x/100); let row = Math.floor(this.pos.y/100);
        for (let c = col - 1; c <= col + 1; c++) {
            for (let r = row - 1; r <= row + 1; r++) {
                let key = `${c},${r}`; let cell = boidGrid[key]; if (!cell) continue;
                for(let idx of cell) {
                    let other = flock[idx]; if(other === this) continue;
                    let dx = this.pos.x - other.pos.x; let dy = this.pos.y - other.pos.y; let dSq = dx*dx + dy*dy;
                    if(dSq < 3600 && dSq > 0) { let d = Math.sqrt(dSq); if(d < 25) { sep.x += dx/d; sep.y += dy/d; } ali.x += other.vel.x; ali.y += other.vel.y; coh.x += other.pos.x; coh.y += other.pos.y; count++; }
                }
            }
        }
        if(count > 0) {
            ali.x /= count; ali.y /= count; ali.x = (ali.x - this.vel.x)*0.1; ali.y = (ali.y - this.vel.y)*0.1;
            coh.x /= count; coh.y /= count; let cx = coh.x - this.pos.x, cy = coh.y - this.pos.y;
            let dist = Math.hypot(cx, cy); if(dist>0) { cx = (cx/dist)*0.05; cy = (cy/dist)*0.05; }
            return { x: sep.x * sW + ali.x * aW + cx * cW, y: sep.y * sW + ali.y * aW + cy * cW };
        }
        return {x:0, y:0};
    }
}

// === UI Control Functions ===
function showStartScreen() {
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('restart-screen').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
}

function hideStartScreen() {
    document.getElementById('start-screen').style.display = 'none';
}

function showRestartScreen(title = 'Game Over!') {
    document.getElementById('restart-screen').style.display = 'flex';
    const restartTitle = document.getElementById('restart-title');
    restartTitle.innerText = title;
    
    // Add or remove victory class based on title
    if (title === 'Victory!') {
        restartTitle.classList.add('victory');
    } else {
        restartTitle.classList.remove('victory');
    }
    
    // Update final stats
    let survivedCount = flock.filter(b => b.tamed).length;
    document.getElementById('final-flock-count').innerText = survivedCount;
    document.getElementById('final-difficulty').innerText = currentDifficulty.toUpperCase();
}

function hideRestartScreen() {
    document.getElementById('restart-screen').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
}

// === Interaction Functions ===
function activateHabitat(h) { h.active = false; globalSpeedMultiplier += 0.2; for(let i=0; i<50; i++) flock.push(new Boid(h.x, h.y)); updateFlockCountUI(); }
function triggerDeath() { if(isGameOver) return; isGameOver = true; survivor.active = false; gameOverEl.style.display = 'none'; statusText.innerText = "DEAD"; statusText.style.color = "#ff3333"; showRestartScreen('Game Over'); }
function scatterFlock() { if (isFlockScattered) return; isFlockScattered = true; feedBtn.classList.add('urgent'); statusText.innerText = "SCATTERED!"; statusText.style.color = "#ff3333"; }
function recallFlock() { 
    // Calculate survived flock count before regenerating
    let survivedCount = flock.filter(b => b.tamed).length;
    let totalCount = flock.length;
    
    // Update UI with only survived count immediately
    flockCountHud.innerText = survivedCount;
    
    // Regenerate flock only if scattered
    if (isFlockScattered) {
        isFlockScattered = false; 
        feedBtn.classList.remove('urgent'); 
        let count = flock.length; 
        flock = []; 
        for(let i=0; i<count; i++) { let angle = Math.random() * Math.PI * 2; let dist = 100 + Math.random() * 200; flock.push(new Boid(survivor.pos.x + Math.cos(angle)*dist, survivor.pos.y + Math.sin(angle)*dist)); } 
        
        // Update UI with new flock count after a short delay to show survived count first
        setTimeout(updateFlockCountUI, 1000); 
    } else {
        // If not scattered, just update UI immediately
        updateFlockCountUI();
    }
}
function setDifficulty(level) {
    currentDifficulty = level;
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.classList.remove('selected');
        if(btn.onclick.toString().includes(level)) btn.classList.add('selected');
    });
    
    // Update difficulty description
    diffText.innerText = DIFFICULTY_DESCRIPTIONS[level].toUpperCase();
    updateTips();
    initWorld();
}
function toggleLure(active) { isLuring = active; if(active) feedBtn.classList.add('active'); else feedBtn.classList.remove('active'); }
function updateFlockCountUI() { if (isFlockScattered) flockCountHud.innerText = "SCATTERED"; else { let tamed = flock.filter(b=>b.tamed).length; flockCountHud.innerText = tamed; } }

function updateTips() {
    const difficultyTip = DIFFICULTY_TIPS[currentDifficulty];
    let html = `<b>${difficultyTip.title}</b>`;
    
    difficultyTip.content.forEach(line => {
        html += `<br>${line}`;
    });
    
    tips.innerHTML = html;
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// Safe path as array of line segments
let safePathPoints = [];

function generateSafePathPoints() {
    const startX = 300, startY = 300;
    const endX = WORLD_SIZE - 400, endY = WORLD_SIZE - 400;

    // Generate different number of waypoints based on difficulty
    let numPoints;
    let maxRandomOffset;

    switch(currentDifficulty) {
        case 'easy':
            numPoints = 5;
            maxRandomOffset = 400;
            break;
        case 'medium':
            numPoints = 8;
            maxRandomOffset = 600;
            break;
        case 'hard':
            numPoints = 10;
            maxRandomOffset = 800;
            break;
        default:
            numPoints = 3;
            maxRandomOffset = 200;
    }

    safePathPoints = [{x: startX, y: startY}];

    // Generate intermediate waypoints
    for(let i = 0; i < numPoints; i++) {
        const t = (i + 1) / (numPoints + 1);
        const baseX = startX + t * (endX - startX);
        const baseY = startY + t * (endY - startY);

        // Add random offset, clamped to world bounds
        const offsetX = (Math.random() - 0.5) * 2 * maxRandomOffset;
        const offsetY = (Math.random() - 0.5) * 2 * maxRandomOffset;

        const px = Math.max(100, Math.min(WORLD_SIZE - 100, baseX + offsetX));
        const py = Math.max(100, Math.min(WORLD_SIZE - 100, baseY + offsetY));

        safePathPoints.push({x: px, y: py});
    }

    safePathPoints.push({x: endX, y: endY});
}

// Calculate distance from point to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        // Segment is a point
        return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // Project point onto line, clamped to segment
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;

    return Math.sqrt((px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY));
}

// Check if point is inside safe path (near any segment)
function isPointInSafePath(x, y, width) {
    // Set different safe path widths based on difficulty
    if (width === undefined) {
        switch(currentDifficulty) {
            case 'easy': width = 150;
                break;
            case 'medium': width = 100;
                break;
            case 'hard': width = 70;
                break;
            default: width = 200;
        }
    }

    // If path points array is empty, generate points
    if(safePathPoints.length === 0) {
        generateSafePathPoints();
    }

    // Check distance to each line segment
    for(let i = 0; i < safePathPoints.length - 1; i++) {
        const p1 = safePathPoints[i];
        const p2 = safePathPoints[i + 1];
        const dist = distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);

        if(dist < width) {
            return true;
        }
    }

    return false;
}

function generateMaze() {
    obstacles = []; habitats = []; predators = []; caves = [];
    // Regenerate points for safe path
    generateSafePathPoints();
    let settings = DIFFICULTY_SETTINGS[currentDifficulty];
    const treeTypes = ['oak', 'pine', 'palm', 'round'];
    
    // Generate cluster obstacles
    for(let i=0; i<settings.clusters; i++) {
        let centerX = Math.random() * WORLD_SIZE;
        let centerY = Math.random() * WORLD_SIZE;
        
        // Set forbidden area radius near start/end based on difficulty
        const startEndRadius = currentDifficulty === 'easy' ? 600 : 
                              currentDifficulty === 'medium' ? 700 : 800;

        const safePathRadius = currentDifficulty === 'easy' ? 100 : 
                              currentDifficulty === 'medium' ? 50 : 20;
        
        // Check if cluster center is near start/end or inside safe path
        if (Math.hypot(centerX-300, centerY-300) < startEndRadius || 
            Math.hypot(centerX-goal.x, centerY-goal.y) < startEndRadius ||
            isPointInSafePath(centerX, centerY, safePathRadius)) continue;
            
        let treeCount = 2 + Math.floor(Math.random() * 3); 
        let clusterType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
        
        for(let t=0; t<treeCount; t++) {
            let angle = Math.random() * Math.PI * 2;
            let dist = Math.random() * 300;
            let x = centerX + Math.cos(angle) * dist;
            let y = centerY + Math.sin(angle) * dist;
            
            // Check if individual obstacle is near start/end or inside safe path
            if (Math.hypot(x-300, y-300) < startEndRadius || 
                Math.hypot(x-goal.x, y-goal.y) < startEndRadius ||
                isPointInSafePath(x, y, safePathRadius)) continue;
                
            obstacles.push({x: x, y: y, r: 40 + Math.random() * 80, seed: Math.random(), type: clusterType});
        }
    }
    
    // Generate scattered obstacles (simplified - just 3 attempts per obstacle)
    const startEndRadius = 600;
    for(let i=0; i<settings.scatter; i++) {
        for(let attempt = 0; attempt < 3; attempt++) {
            let x = Math.random() * WORLD_SIZE;
            let y = Math.random() * WORLD_SIZE;

            // Quick rejection checks
            if (Math.hypot(x-300, y-300) < startEndRadius) continue;
            if (Math.hypot(x-goal.x, y-goal.y) < startEndRadius) continue;
            if (isPointInSafePath(x, y, 200)) continue;

            let r = 30 + Math.random() * 90;
            let type = treeTypes[Math.floor(Math.random() * treeTypes.length)];
            obstacles.push({x: x, y: y, r: r, seed: Math.random(), type: type});
            break; // Found valid position, move to next obstacle
        }
    }
    for(let i=0; i<8; i++) { caves.push({x: Math.random()*WORLD_SIZE, y: Math.random()*WORLD_SIZE, r: 50}); }
    let hCount = 0; while(hCount < 18) {
        let x = Math.random() * WORLD_SIZE, y = Math.random() * WORLD_SIZE;
        let conflict = false; 
        
        // Check if habitat is too close to world boundaries (500 pixel margin)
        if (x < 500 || x > WORLD_SIZE - 500 || y < 500 || y > WORLD_SIZE - 500) {
            continue;
        }
        
        // Check for conflict with obstacles
        for(let o of obstacles) { if(Math.hypot(x-o.x, y-o.y) < o.r + 80) { conflict = true; break; } }
        
        if(!conflict) {
            // Expand speed habitat radius by 125% (from 60 to 75), keep shield habitat radius as 60
            const type = Math.random() > 0.5 ? 'speed' : 'shield';
            const radius = type === 'speed' ? 75 : 60;
            habitats.push({x: x, y: y, r: radius, type: type, active: true});
            hCount++;
        }
    }
    for(let i=0; i<settings.wolfCount; i++) predators.push(new Predator());
}

function initWorld() {
    isGameOver = false; survivor = new Survivor();
    // Reset global path to ensure immediate replanning after difficulty change
    globalPath = [];
    pathIndex = 0;
    waypoints = []; // Clear all player-added waypoints when updating map
    let maxAttempts = 10; // Reduced from 100 for faster startup
    let validMap = false;

    // Try to generate a valid map
    for(let attempt = 0; attempt < maxAttempts && !validMap; attempt++) {
        generateMaze();
        pathfinder.bakeNavMesh();

        // Check if there's a feasible path between start and end points
        let testPath = pathfinder.findPath({x: 300, y: 300}, goal);
        if(testPath && testPath.length > 1) {
            validMap = true;
        }
    }

    // If still unable to generate valid map, clear obstacles blocking path
    if(!validMap) {
        obstacles = [];
        pathfinder.bakeNavMesh();
    }

    flock = []; for(let i=0; i<800; i++) flock.push(new Boid()); // Reduced from 1200
    WeatherSystem.init(); updateFlockCountUI();
    
    // Reset weather buttons to default state
    document.querySelectorAll('.weather-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.dataset.weather === 'sunny') {
            btn.classList.add('active');
        }
    });
}

// Frame rate limiting variables
let lastFrameTime = 0;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS; // ~33.3 milliseconds per frame

function draw(currentTime = 0) {
    // Calculate time since last frame
    const deltaTime = currentTime - lastFrameTime;
    
    // Only update and draw if enough time has passed
    if (deltaTime < FRAME_INTERVAL) {
        // Continue the loop without updating
        requestAnimationFrame(draw);
        return;
    }
    
    // Update last frame time, subtract remainder to keep timing consistent
    lastFrameTime = currentTime - (deltaTime % FRAME_INTERVAL);
    if(tempMarker && Date.now() - tempMarker.createTime > 8000) tempMarker = null;
    WeatherSystem.update(); updateBoidGrid(); updateAI(); 
    for(let p of predators) p.update(); survivor.update(); for(let b of flock) b.update();
    
    if(camera.locked && survivor.active) {
        // Directly set camera position to survivor position for instant centering
        camera.x = survivor.pos.x + 50;
        camera.y = survivor.pos.y;
        // let vw = canvas.width/camera.zoom, vh = canvas.height/camera.zoom;
        // camera.x = Math.max(vw/2, Math.min(camera.x, WORLD_SIZE-vw/2)); camera.y = Math.max(vh/2, Math.min(camera.y, WORLD_SIZE-vh/2));
    }

    ctx.fillStyle = WeatherSystem.colors.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width/2, canvas.height/2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);

    let vl = camera.x - canvas.width/camera.zoom/2 - 200, vr = camera.x + canvas.width/camera.zoom/2 + 200;
    let vt = camera.y - canvas.height/camera.zoom/2 - 200, vb = camera.y + canvas.height/camera.zoom/2 + 200;

    if (groundPattern) { ctx.fillStyle = groundPattern; ctx.fillRect(vl, vt, vr - vl, vb - vt); }
    for(let o of obstacles) { if(o.x+o.r>vl && o.x-o.r<vr && o.y+o.r>vt && o.y-o.r<vb) drawCartoonTree(ctx, o); }
    
    ctx.fillStyle = "rgba(0,0,0,0.5)"; for(let c of caves) ctx.beginPath(), ctx.arc(c.x, c.y, c.r, 0, 6.28), ctx.fill();
    WeatherSystem.draw(ctx, vl, vr, vt, vb);

    for(let h of habitats) {
        if(!h.active && h.type==='speed') continue;
        let col = h.type === 'speed' ? '#00ffff' : '#ffd700';
        ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 6.28); ctx.stroke();
        ctx.fillStyle = col; ctx.globalAlpha = 0.3; ctx.fill(); ctx.restore();
    }

    for(let p of predators) p.draw(ctx);
    
    // Draw path
    if(globalPath.length > 1) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 6;
        ctx.setLineDash([15, 10]);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(globalPath[0].x, globalPath[0].y);
        for(let i = 1; i < globalPath.length; i++) {
            ctx.lineTo(globalPath[i].x, globalPath[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
        
        // Draw path points
        for(let i = 0; i < globalPath.length; i++) {
            ctx.fillStyle = i === 0 ? '#00ff00' : (i === globalPath.length - 1 ? '#ff00ff' : '#ffff00');
            ctx.beginPath();
            ctx.arc(globalPath[i].x, globalPath[i].y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 10; ctx.setLineDash([20, 10]); ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
    if(survivor.active) survivor.draw(ctx);

    if(!isFlockScattered) {
        let time = Date.now() * 0.02; 
        for(let b of flock) {
            if(b.pos.x<vl || b.pos.x>vr || b.pos.y<vt || b.pos.y>vb) continue;
            let bodyCol = b.tamed ? '#FFD700' : '#444'; 
            if(b.tamed && flockState === "FETCHING") bodyCol = '#ff6655';
            if(b.tamed && survivor.boostTimer > 0) bodyCol = '#ffffff';

            ctx.save(); ctx.translate(b.pos.x, b.pos.y); ctx.rotate(Math.atan2(b.vel.y, b.vel.x));
            let s = b.tamed ? 1.0 : 0.7; let flap = Math.sin(time * (0.2 + Math.hypot(b.vel.x, b.vel.y) * 0.05));
            ctx.fillStyle = b.tamed ? '#DAA520' : '#333';
            ctx.beginPath(); ctx.moveTo(2*s, 0); ctx.lineTo(-2*s, -12*s + flap*5); ctx.lineTo(-5*s, -6*s); ctx.fill();
            ctx.beginPath(); ctx.moveTo(2*s, 0); ctx.lineTo(-2*s, 12*s - flap*5); ctx.lineTo(-5*s, 6*s); ctx.fill();
            ctx.fillStyle = bodyCol; ctx.beginPath(); ctx.ellipse(0,0, 7*s, 3*s, 0, 0, 6.28); ctx.fill();
            ctx.fillStyle = '#FFCC00'; ctx.beginPath(); ctx.moveTo(6*s, -1*s); ctx.lineTo(9*s, 0); ctx.lineTo(6*s, 1*s); ctx.fill();
            ctx.restore();
        }
    }
    if(tempMarker) { ctx.fillStyle = '#00ffff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tempMarker.x, tempMarker.y, 10, 0, 6.28); ctx.fill(); ctx.stroke(); }
    
    // Draw waypoints
    for(let wp of waypoints) {
        ctx.save();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r, 0, 6.28); ctx.stroke();
        ctx.fillStyle = wp.color || '#00ff00'; ctx.globalAlpha = 0.3; ctx.fill(); ctx.restore();
        // Draw waypoint number
        ctx.fillStyle = '#fff'; ctx.font = "14px Arial"; ctx.textAlign = "center"; 
        ctx.fillText((waypoints.indexOf(wp)+1).toString(), wp.x, wp.y + 5);
    }
    ctx.restore(); drawMinimap(); requestAnimationFrame(draw);
}

function drawMinimap() {
    miniCtx.fillStyle = '#111'; miniCtx.fillRect(0,0,220,220); let s = 220/WORLD_SIZE;
    miniCtx.fillStyle = '#333'; for(let o of obstacles) if(o.r>40) miniCtx.beginPath(), miniCtx.arc(o.x*s, o.y*s, o.r*s, 0, 6.28), miniCtx.fill();
    miniCtx.fillStyle = '#ff3333'; for(let p of predators) miniCtx.beginPath(), miniCtx.arc(p.pos.x*s, p.pos.y*s, 4, 0, 6.28), miniCtx.fill();
    if(survivor.active) { miniCtx.fillStyle = '#fff'; miniCtx.beginPath(); miniCtx.arc(survivor.pos.x*s, survivor.pos.y*s, 3, 0, 6.28); miniCtx.fill(); }
}

// === Event Listeners ===
toggleBtn.addEventListener('click', () => { panel.classList.toggle('collapsed'); toggleBtn.innerHTML = panel.classList.contains('collapsed') ? '◀' : '▶'; });
document.querySelectorAll('.weather-btn').forEach(btn => { btn.addEventListener('click', function() { document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active')); this.classList.add('active'); WeatherSystem.setWeather(this.dataset.weather); }); });
feedBtn.addEventListener('mousedown', () => { 
    // Always calculate and update survived count when call button is pressed
    let survivedCount = flock.filter(b => b.tamed).length;
    flockCountHud.innerText = survivedCount;
    
    if(isFlockScattered) {
        recallFlock(); 
    } else {
        toggleLure(true);
        // Update UI immediately for non-scattered case
        updateFlockCountUI();
    }
});
feedBtn.addEventListener('mouseup', () => toggleLure(false));
canvas.addEventListener('mousedown', e => { 
    if(e.button === 0) { 
        isDraggingMap = true; 
        lastMouse = {x:e.clientX, y:e.clientY}; 
        camera.locked = false; 
        lockBtn.classList.add('unlocked'); 
    } 
    if(e.button === 2) { 
        const pos = getWorldCoords(e.clientX, e.clientY);
        // Check if right click on a waypoint to remove it
        let removed = false;
        for (let i = waypoints.length - 1; i >= 0; i--) {
            const wp = waypoints[i];
            const dist = Math.hypot(pos.x - wp.x, pos.y - wp.y);
            if (dist < wp.r) {
                waypoints.splice(i, 1);
                globalPath = []; // Reset path to regenerate with new waypoints
                removed = true;
                break;
            }
        }
        // If no waypoint removed, create a new one
        if (!removed) {
            // Right click creates a waypoint (radius 75, green, similar to habitat)
            waypoints.push({x: pos.x, y: pos.y, r: 75, type: 'waypoint', color: '#00ff00'});
            globalPath = []; // Reset path to regenerate with new waypoint
        }
    } 
});
window.addEventListener('mouseup', () => isDraggingMap = false);
canvas.addEventListener('mousemove', e => { if(isDraggingMap) { camera.x -= (e.clientX - lastMouse.x)/camera.zoom; camera.y -= (e.clientY - lastMouse.y)/camera.zoom; lastMouse = {x:e.clientX, y:e.clientY}; } });
lockBtn.addEventListener('click', () => { camera.locked = !camera.locked; lockBtn.classList.toggle('unlocked', !camera.locked); });
canvas.addEventListener('wheel', e => { e.preventDefault(); camera.zoom = Math.max(0.1, Math.min(5.0, camera.zoom + e.deltaY*-0.001)); }, { passive: false });
function getWorldCoords(sx, sy) { return { x: camera.x + (sx - canvas.width/2) / camera.zoom, y: camera.y + (sy - canvas.height/2) / camera.zoom }; }

// Start Game Button
const startBtn = document.getElementById('start-btn');
startBtn.addEventListener('click', () => {
    hideStartScreen();
    initWorld();
    draw();
});

// Restart Game Button
const restartBtn = document.getElementById('restart-btn');
restartBtn.addEventListener('click', () => {
    hideRestartScreen();
    initWorld();
    isGameOver = false;
});

// Initialization - Show Start Screen First
showStartScreen();

// Initialize difficulty description and tips
diffText.innerText = DIFFICULTY_DESCRIPTIONS[currentDifficulty].toUpperCase();
updateTips();