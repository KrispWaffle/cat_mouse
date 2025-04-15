const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 70;
const ROWS = 10;
const COLS = 15;
canvas.width = TILE_SIZE * COLS;
canvas.height = TILE_SIZE * ROWS;

// Tile values
const EMPTY = 0;
const WALL = 1;
const CHEESE = 2;
const CAT = 3;
const ACTIONS = ["up", "down", "left", "right"];

// Game state
let mouse = { x: 0, y: 0 };
let grid;
let q = {};

// Utility functions
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

    // Draw mouse
    ctx.fillStyle = "gray";
    ctx.beginPath();
    ctx.arc(mouse.x * TILE_SIZE + TILE_SIZE / 2, mouse.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
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

function initializeQTable() {
    q = {};
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (grid[y][x] !== WALL) {
                q[`${y},${x}`] = Object.fromEntries(ACTIONS.map(a => [a, 0]));
            }
        }
    }
}

// Q-learning training
function trainQTable(episodes = 1000, alpha = 0.5, gamma = 0.9, eps = 0.2) {
    for (let i = 0; i < episodes; i++) {
        let state = { x: 0, y: 0 };
        let stateKey = `${state.y},${state.x}`;
        let steps = 0;

        while (grid[state.y][state.x] !== CHEESE && steps < 100) {
            steps++;
            let action;

            if (Math.random() < eps) {
                action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
            } else {
                const maxQ = Math.max(...Object.values(q[stateKey]));
                const bestActions = Object.entries(q[stateKey])
                    .filter(([_, value]) => value === maxQ)
                    .map(([a]) => a);
                action = bestActions[Math.floor(Math.random() * bestActions.length)];
            }

            let next = move(state, action);
            let nextKey = `${next.y},${next.x}`;
            let reward = getReward(next.x, next.y);

            if (!q[nextKey]) continue; // ignore moves into undefined states

            let oldQ = q[stateKey][action];
            let maxFutureQ = Math.max(...Object.values(q[nextKey]));
            q[stateKey][action] = oldQ + alpha * (reward + gamma * maxFutureQ - oldQ);

            state = next;
            stateKey = nextKey;
        }
    }
}

// Run trained policy
const hist = []
function followQPolicy() {
    mouse = { x: 0, y: 0 };
    let steps = 0;

    const interval = setInterval(() => {
        drawGrid();

        let stateKey = `${mouse.y},${mouse.x}`;
        if (!q[stateKey]) {
            console.log("🤖 Invalid state, stopping.");
            clearInterval(interval);
            return;
        }

        if (grid[mouse.y][mouse.x] === CHEESE) {
            console.log("🎉 Got the cheese!");
            clearInterval(interval);
            return;
        }

        if (grid[mouse.y][mouse.x] === CAT) {
            console.log("💀 Eaten by cat!");
            clearInterval(interval);
            resetGame();
            return;
        }

        const maxQ = Math.max(...Object.values(q[stateKey]));
        
        const bestActions = Object.entries(q[stateKey])
            .filter(([_, val]) => val === maxQ)
            .map(([act]) => act);

        const action = bestActions.length > 0 ? randomChoice(bestActions) : ACTIONS[Math.floor(Math.random() * 4)];
        hist.push(action)
        mouse = move(mouse, action);

        steps++;
        if (steps > 200) {
            console.log("⏹️ Mouse got stuck.");
            clearInterval(interval);
        }
    }, 200);
}
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function resetGame() {
    grid = createEmptyGrid();
    placeCats(grid);
    initializeQTable();
    trainQTable();

    followQPolicy();
    console.log(hist)

}

// Init & run
resetGame();