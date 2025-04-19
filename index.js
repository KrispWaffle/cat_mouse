const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 70;
const ROWS = 10;
const COLS = 15;
canvas.width = TILE_SIZE * COLS;
canvas.height = TILE_SIZE * ROWS;

const EMPTY = 0;
const WALL = 1;
const CHEESE = 2;
const CAT = 3;
const ACTIONS = ["up", "down", "left", "right"];

const NUM_MICE = 5;
let mice = Array.from({ length: NUM_MICE }, (_, i) => ({
    id: i,
    x: 0,
    y: 0,
    color: `hsl(${(i * 360) / NUM_MICE}, 100%, 50%)`,
    q: {},
    episode: 0,
    steps:0,
}));

let grid = createEmptyGrid();
placeCats(grid);

function createEmptyGrid() {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    grid[ROWS - 1][COLS - 1] = CHEESE;
    return grid;
}

function placeCats(grid, numCats = 14) {
    let cats = 0;
    while (cats <= numCats) {
        let y = Math.floor(Math.random() * ROWS);
        let x = Math.floor(Math.random() * COLS);
        if ((y === 0 && x === 0) || grid[y][x] !== EMPTY) continue;
        grid[y][x] = CAT;
        cats++;
    }
}

function drawGrid() {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (grid[y][x] === WALL) ctx.fillStyle = "#333";
            else if (grid[y][x] === CHEESE) ctx.fillStyle = "yellow";
            else if (grid[y][x] === CAT) ctx.fillStyle = "red";
            else ctx.fillStyle = "white";

            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    for (const mouse of mice) {
        ctx.fillStyle = mouse.color;
        ctx.beginPath();
        ctx.arc(mouse.x * TILE_SIZE + TILE_SIZE / 2, mouse.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initializeAllQTables() {
    for (const mouse of mice) {
        mouse.q = {};
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (grid[y][x] !== WALL) {
                    mouse.q[`${y},${x}`] = Object.fromEntries(ACTIONS.map(a => [a, 0]));
                }
            }
        }
    }
}

function getReward(x, y) {
    if (grid[y][x] === CHEESE) return 100;
    if (grid[y][x] === CAT) return -100;
    return -1;
}

function move({ x, y }, action) {
    if (action === "up" && y > 0 && grid[y - 1][x] !== WALL) y--;
    else if (action === "down" && y < ROWS - 1 && grid[y + 1][x] !== WALL) y++;
    else if (action === "left" && x > 0 && grid[y][x - 1] !== WALL) x--;
    else if (action === "right" && x < COLS - 1 && grid[y][x + 1] !== WALL) x++;

    return { x, y };
}

function trainOneEpisode(mouse, alpha = 0.5, gamma = 0.9, eps = 0.2) {
    let state = { x: 0, y: 0 };
    let stateKey = `${state.y},${state.x}`;
    let steps = 0;

    while (grid[state.y][state.x] !== CHEESE && steps < 100) {
        steps++;
        let action;

        if (Math.random() < eps) {
            action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
        } else {
            const maxQ = Math.max(...Object.values(mouse.q[stateKey]));
            const bestActions = Object.entries(mouse.q[stateKey])
                .filter(([_, value]) => value === maxQ)
                .map(([a]) => a);
            action = bestActions[Math.floor(Math.random() * bestActions.length)];
        }

        let next = move(state, action);
        let nextKey = `${next.y},${next.x}`;
        let reward = getReward(next.x, next.y);

        if (!mouse.q[nextKey]) continue;

        let oldQ = mouse.q[stateKey][action];
        let maxFutureQ = Math.max(...Object.values(mouse.q[nextKey]));
        mouse.q[stateKey][action] = oldQ + alpha * (reward + gamma * maxFutureQ - oldQ);

        state = next;
        stateKey = nextKey;
    }
}

function trainAllMiceAndShow() {
    
    for (const mouse of mice) {
        
        trainOneEpisode(mouse);
        mouse.episode++;
        let stateKey = `${mouse.y},${mouse.x}`;
        const qTable = mouse.q[stateKey];
        if (!qTable) continue;

        const maxQ = Math.max(...Object.values(qTable));
        const bestActions = Object.entries(qTable)
            .filter(([_, val]) => val === maxQ)
            .map(([act]) => act);

        const action = bestActions.length > 0 ? randomChoice(bestActions) : ACTIONS[Math.floor(Math.random() * 4)];
        const next = move(mouse, action);
        mouse.x = next.x;
        mouse.y = next.y;
        mouse.steps++;

        if (grid[mouse.y][mouse.x] === CHEESE || grid[mouse.y][mouse.x] === CAT || mouse.steps ===100) {
            mouse.x = 0;
            mouse.y = 0;
            mouse.steps=0;
        }
        
    }

    drawGrid();
    setTimeout(trainAllMiceAndShow, 500);
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}


initializeAllQTables();
trainAllMiceAndShow();