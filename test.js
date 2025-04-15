const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 70;
const ROWS = 10;
const COLS = 15;
canvas.width = TILE_SIZE * COLS;
canvas.height = TILE_SIZE * ROWS;

// Tile values
const EMPTY = 0, WALL = 1, CHEESE = 2, CAT = 3;
const ACTIONS = ["up", "down", "left", "right"];

// Game state
let mouse = { x: 0, y: 0 };
let grid;
let q = {};

let currentEpisode = 0;

let maxEpisodes = 1000000000;
let stepSpeed = 50; // ms between steps
let training = true;
let successHistory = [];
const SUCCESS_HISTORY_LIMIT = 20;

function logSuccessRate() {
    const successes = successHistory.filter(success => success).length;
    const rate = ((successes / successHistory.length) * 100).toFixed(1);
    console.log(`✅ Success Rate (last ${successHistory.length}): ${rate}%`);
}
function createEmptyGrid() {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    grid[ROWS - 1][COLS - 1] = CHEESE;
    return grid;
}

function placeCats(grid, numCats = 14) {
    let cats = 0;
    while (cats < numCats) {
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

function chooseAction(stateKey, eps) {
    if (Math.random() < eps) {
        return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    }
    const maxQ = Math.max(...Object.values(q[stateKey]));
    const bestActions = Object.entries(q[stateKey])
        .filter(([_, val]) => val === maxQ)
        .map(([act]) => act);
    return bestActions[Math.floor(Math.random() * bestActions.length)];
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function runLearningEpisode(alpha = 0.5, gamma = 0.9, eps = 0.3) {
    mouse = { x: 0, y: 0 };
    let state = { ...mouse };
    let stateKey = `${state.y},${state.x}`;
    let steps = 0;

    return new Promise(resolve => {
        const interval = setInterval(() => {
            drawGrid();

            const action = chooseAction(stateKey, eps);
            let next = move(state, action);
            let nextKey = `${next.y},${next.x}`;

            let reward = getReward(next.x, next.y);

            if (!q[nextKey]) {
                reward = -10;
                next = state;
                nextKey = stateKey;
            }

            let oldQ = q[stateKey][action];
            let maxFutureQ = Math.max(...Object.values(q[nextKey]));
            q[stateKey][action] = oldQ + alpha * (reward + gamma * maxFutureQ - oldQ);

            state = next;
            stateKey = nextKey;
            mouse = { ...state };

            steps++;

            if (grid[state.y][state.x] === CHEESE || grid[state.y][state.x] === CAT || steps > 100) {
                clearInterval(interval);
            
                const success = grid[state.y][state.x] === CHEESE;
                successHistory.push(success);
                if (successHistory.length > SUCCESS_HISTORY_LIMIT) {
                    successHistory.shift();
                }
                logSuccessRate();
            
                console.log(`Episode ${currentEpisode} done. Steps: ${steps} ${success ? "✅ Success" : "❌ Failure"}`);
                resolve();
            }
        }, stepSpeed);
        
    });
    
}

function runTrainingEpisodeFast(alpha = 0.2, gamma = 0.9, eps = 0.3) {
    let state = { x: 0, y: 0 };
    let stateKey = `${state.y},${state.x}`;
    let steps = 0;

    while (grid[state.y][state.x] !== CHEESE &&
           grid[state.y][state.x] !== CAT &&
           steps < 100) {

        const action = chooseAction(stateKey, eps);
        let next = move(state, action);
        let nextKey = `${next.y},${next.x}`;
        let reward = getReward(next.x, next.y);

        if (!q[nextKey]) {
            reward = -10;
            next = state;
            nextKey = stateKey;
        }

        const oldQ = q[stateKey][action];
        const maxFutureQ = Math.max(...Object.values(q[nextKey]));
        q[stateKey][action] = oldQ + alpha * (reward + gamma * maxFutureQ - oldQ);

        state = next;
        stateKey = nextKey;
        steps++;
    }

    const success = grid[state.y][state.x] === CHEESE;
    successHistory.push(success);
    if (successHistory.length > SUCCESS_HISTORY_LIMIT) successHistory.shift();
}

// 🆕 Updated train function — combines fast + visual
async function trainAndVisualize() {
    const batchSize = 1000; // fast train cycles per visual
    while (currentEpisode < maxEpisodes && training) {
        // fast training episodes
        for (let i = 0; i < batchSize; i++) {
            runTrainingEpisodeFast();
            currentEpisode++;
        }

        // show one episode visually every batch
        console.log(`Showing visual episode at ${currentEpisode}`);
        await runLearningEpisode(); // one slow/visible run
        logSuccessRate();
    }
}

function resetGame() {
    grid = createEmptyGrid();
    placeCats(grid);
    initializeQTable();
    currentEpisode = 0;
    training = true;
    trainAndVisualize();
}

resetGame();
