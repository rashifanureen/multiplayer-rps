// ============================================
// ROCK PAPER SCISSORS - MULTIPLAYER CLIENT
// ============================================

// The backend URL will be added after deployment.
// For local testing, use your local server.
const SERVER_URL = "https://multiplayer-rps-server.onrender.com";

const socket = io(SERVER_URL);


// ============================================
// SCREEN ELEMENTS
// ============================================

const homeScreen = document.getElementById("homeScreen");
const waitingScreen = document.getElementById("waitingScreen");
const gameScreen = document.getElementById("gameScreen");


// ============================================
// HOME ELEMENTS
// ============================================

const playerName = document.getElementById("playerName");
const joinName = document.getElementById("joinName");
const roomInput = document.getElementById("roomInput");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");

const homeMessage = document.getElementById("homeMessage");


// ============================================
// WAITING ROOM ELEMENTS
// ============================================

const roomCode = document.getElementById("roomCode");
const copyRoomBtn = document.getElementById("copyRoomBtn");
const cancelRoomBtn = document.getElementById("cancelRoomBtn");
const waitingMessage = document.getElementById("waitingMessage");


// ============================================
// GAME ELEMENTS
// ============================================

const gameRoomCode = document.getElementById("gameRoomCode");

const player1Name = document.getElementById("player1Name");
const player2Name = document.getElementById("player2Name");

const player1Score = document.getElementById("player1Score");
const player2Score = document.getElementById("player2Score");

const player1Status = document.getElementById("player1Status");
const player2Status = document.getElementById("player2Status");

const roundText = document.getElementById("roundText");
const gameMessage = document.getElementById("gameMessage");

const choices = document.querySelectorAll(".choice");

const resultBox = document.getElementById("resultBox");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

const gameOverBox = document.getElementById("gameOverBox");
const winnerText = document.getElementById("winnerText");

const playAgainBtn = document.getElementById("playAgainBtn");
const leaveGameBtn = document.getElementById("leaveGameBtn");


// ============================================
// GAME VARIABLES
// ============================================

let currentRoom = "";
let myName = "";
let myPlayerId = "";


// ============================================
// HELPER - SHOW SCREEN
// ============================================

function showScreen(screen) {

    homeScreen.classList.add("hidden");
    waitingScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}


// ============================================
// HELPER - MESSAGE
// ============================================

function showHomeMessage(message) {

    homeMessage.textContent = message;
}


// ============================================
// CREATE ROOM
// ============================================

createBtn.addEventListener("click", () => {

    const name = playerName.value.trim();

    if (!name) {

        showHomeMessage("Please enter your name.");

        return;
    }

    myName = name;

    socket.emit("createRoom", {
        name: myName
    });
});


// ============================================
// JOIN ROOM
// ============================================

joinBtn.addEventListener("click", () => {

    const name = joinName.value.trim();

    const code = roomInput.value.trim().toUpperCase();

    if (!name) {

        showHomeMessage("Please enter your name.");

        return;
    }

    if (!code) {

        showHomeMessage("Please enter a room code.");

        return;
    }

    myName = name;

    socket.emit("joinRoom", {
        name: myName,
        roomCode: code
    });
});


// ============================================
// ROOM CREATED
// ============================================

socket.on("roomCreated", (data) => {

    currentRoom = data.roomCode;

    myPlayerId = socket.id;

    roomCode.textContent = currentRoom;

    waitingMessage.textContent =
        "Waiting for another player to join...";

    showScreen(waitingScreen);
});


// ============================================
// JOIN ERROR
// ============================================

socket.on("roomError", (message) => {

    showHomeMessage(message);
});


// ============================================
// PLAYER JOINED
// ============================================

socket.on("playerJoined", (data) => {

    currentRoom = data.roomCode;

    myPlayerId = socket.id;

    setupGame(data.players);

    showScreen(gameScreen);

    gameMessage.textContent =
        "Both players are ready! Choose your move.";
});


// ============================================
// GAME STARTED
// ============================================

socket.on("gameStarted", (data) => {

    setupGame(data.players);

    showScreen(gameScreen);

    gameMessage.textContent =
        "Choose Rock, Paper, or Scissors!";
});


// ============================================
// SETUP GAME
// ============================================

function setupGame(players) {

    if (!players || players.length < 1) {
        return;
    }

    gameRoomCode.textContent = currentRoom;

    const p1 = players[0];

    player1Name.textContent = p1.name;
    player1Score.textContent = p1.score || 0;

    player1Status.textContent =
        p1.ready ? "Ready" : "Waiting...";


    if (players.length >= 2) {

        const p2 = players[1];

        player2Name.textContent = p2.name;

        player2Score.textContent =
            p2.score || 0;

        player2Status.textContent =
            p2.ready ? "Ready" : "Waiting...";

    } else {

        player2Name.textContent =
            "Waiting...";

        player2Score.textContent = "0";

        player2Status.textContent =
            "Waiting...";
    }
}


// ============================================
// MAKE MOVE
// ============================================

choices.forEach(button => {

    button.addEventListener("click", () => {

        const choice = button.dataset.choice;

        makeMove(choice);
    });
});


function makeMove(choice) {

    if (!currentRoom) {
        return;
    }

    // Disable all buttons after choosing
    choices.forEach(button => {
        button.disabled = true;
    });

    gameMessage.textContent =
        `You chose ${choice}. Waiting for opponent...`;

    socket.emit("makeMove", {
        roomCode: currentRoom,
        choice: choice
    });
}


// ============================================
// MOVE RECEIVED
// ============================================

socket.on("moveMade", (data) => {

    if (data.playerId === myPlayerId) {

        player1Status.textContent = "Selected";

    } else {

        player2Status.textContent = "Selected";
    }

    gameMessage.textContent =
        "Move received. Waiting for the other player...";
});


// ============================================
// ROUND RESULT
// ============================================

socket.on("roundResult", (data) => {

    choices.forEach(button => {
        button.disabled = true;
    });

    player1Score.textContent =
        data.scores.player1;

    player2Score.textContent =
        data.scores.player2;


    roundText.textContent =
        `Round ${data.round}`;


    resultBox.classList.remove("hidden");

    resultTitle.textContent =
        data.result;


    resultText.textContent =
        `${data.player1Choice} vs ${data.player2Choice}`;


    gameMessage.textContent =
        data.message;


    player1Status.textContent =
        "Waiting...";

    player2Status.textContent =
        "Waiting...";
});


// ============================================
// NEXT ROUND
// ============================================

socket.on("nextRound", (data) => {

    resultBox.classList.add("hidden");

    choices.forEach(button => {
        button.disabled = false;
    });

    roundText.textContent =
        `Round ${data.round}`;

    gameMessage.textContent =
        "Choose your move!";
});


// ============================================
// GAME OVER
// ============================================

socket.on("gameOver", (data) => {

    choices.forEach(button => {
        button.disabled = true;
    });

    resultBox.classList.add("hidden");

    gameOverBox.classList.remove("hidden");

    winnerText.textContent =
        `🏆 ${data.winner} Wins!`;

    gameMessage.textContent =
        "Game over!";
});


// ============================================
// PLAY AGAIN
// ============================================

playAgainBtn.addEventListener("click", () => {

    gameOverBox.classList.add("hidden");

    socket.emit("playAgain", {
        roomCode: currentRoom
    });
});


// ============================================
// GAME RESET
// ============================================

socket.on("gameReset", (data) => {

    player1Score.textContent = "0";

    player2Score.textContent = "0";

    roundText.textContent = "Round 1";

    resultBox.classList.add("hidden");

    gameOverBox.classList.add("hidden");

    choices.forEach(button => {
        button.disabled = false;
    });

    gameMessage.textContent =
        "Choose your move!";
});


// ============================================
// COPY ROOM CODE
// ============================================

copyRoomBtn.addEventListener("click", async () => {

    try {

        await navigator.clipboard.writeText(currentRoom);

        copyRoomBtn.textContent =
            "✅ Copied!";

        setTimeout(() => {

            copyRoomBtn.textContent =
                "📋 Copy Room Code";

        }, 1500);

    } catch (error) {

        alert(
            `Room Code: ${currentRoom}`
        );
    }
});


// ============================================
// LEAVE WAITING ROOM
// ============================================

cancelRoomBtn.addEventListener("click", () => {

    socket.emit("leaveRoom");

    currentRoom = "";

    showScreen(homeScreen);
});


// ============================================
// LEAVE GAME
// ============================================

leaveGameBtn.addEventListener("click", () => {

    socket.emit("leaveRoom");

    currentRoom = "";

    showScreen(homeScreen);
});


// ============================================
// PLAYER DISCONNECTED
// ============================================

socket.on("playerDisconnected", (message) => {

    alert(message);

    currentRoom = "";

    showScreen(homeScreen);
});


// ============================================
// CONNECTION STATUS
// ============================================

socket.on("connect", () => {

    console.log("Connected to multiplayer server.");

    myPlayerId = socket.id;
});


socket.on("disconnect", () => {

    console.log("Disconnected from server.");

    gameMessage.textContent =
        "Connection lost. Please refresh the page.";
});