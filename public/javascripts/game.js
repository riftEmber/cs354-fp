$(document).ready(function () {
    const SECOND = 1000;
    const REQUIRED_PLAYERS = 4;

    if (!("WebSocket" in window)) {
        console.log("A browser supporting WebSockets is required");
        return;
    }
    let wsUrl = $("#game-script").attr("ws-url");
    // workaround for 'secure' request header set incorrectly
    if (location.protocol === "https:") {
        wsUrl = wsUrl.replace("ws://", "wss://");
    }
    console.log(`connecting to ${wsUrl}`);
    let conn = new WebSocket(wsUrl);

    conn.onopen = function (event) {
        console.log("ws connection established");
        sendGameUpdate("hello")
        setInterval(() => sendGameUpdate("ping"), 20 * SECOND);
    };

    conn.onmessage = (messageEvent) => receiveGameUpdate(JSON.parse(messageEvent.data));

    conn.onclose = function (closeEvent) {
        if (closeEvent.wasClean) {
            console.log(`connection closed cleanly, code=${closeEvent.code} reason=${closeEvent.reason}`);
        } else {
            console.log(`connection closed unexpectedly, code=${closeEvent.code}`);
        }
    };

    conn.onerror = (error) => console.log(error);

    $(window).on('beforeunload', function () {
        sendGameUpdate("bye")
        conn.close();
    });

    function sendGameUpdate(updateType, data = null) {
        const jsonMessage = {updateType: updateType, userID: userID, data: data}
        if (conn.readyState !== WebSocket.OPEN) {
            console.error("cannot send message as WebSocket is not open", jsonMessage);
            return;
        }
        const message = JSON.stringify(jsonMessage)
        console.log("sending message to server:", jsonMessage);
        conn.send(message);
    }

    function receiveGameUpdate(jsonMessage) {
        console.log("received message from server:", jsonMessage);
        switch (jsonMessage.updateType) {
            case "hello":
                if (userID <= 0) {
                    // assign initial user ID
                    userID = jsonMessage.userID;
                }
                if (jsonMessage.data["data"] != null) {
                    updateGame(jsonMessage.data["data"]);
                }
                updatePlayers(jsonMessage.data["players"]);
                if (jsonMessage.data["turn"] != null) {
                    updateTurn(jsonMessage.data["turn"]);
                }
                break;
            case "guessResult":
                if (jsonMessage.data["valid"]) {
                    const squareColor = jsonMessage.data["color"].toLowerCase();
                    const square = $(`#square-${jsonMessage.data["index"]}`);
                    square.css({
                        "background-color": squareColor,
                        "color": (squareColor === "black" ? "white" : "black")
                    });
                    square.text("");
                    $("#guessesDisplay").text(jsonMessage.data["guessesRemaining"]);
                    if (jsonMessage.data["guessesRemaining"] < 1) {
                        displayNotification("Guessing completed");
                        $("#guessesContainer").fadeOut();
                        updateTurn(jsonMessage.data["turn"]);
                    }
                } else if (jsonMessage.userID === userID) {
                    displayNotification("Invalid guess");
                }
                break;
            case "clue":
                if (jsonMessage.data["valid"]) {
                    updateTurn(jsonMessage.data["turn"]);
                    displayNotification(`clue given: ${jsonMessage.data.clue}, ${jsonMessage.data.numGuesses}`);
                    $("#clueDisplay").text(`${jsonMessage.data.clue}, ${jsonMessage.data.numGuesses} guesses`);
                    $("#clueContainer").fadeIn();
                    $("#guessesContainer").fadeIn();
                    $("#guessesDisplay").text(jsonMessage.data.numGuesses);
                } else if (jsonMessage.userID === userID) {
                    displayNotification("Invalid clue, try again");
                    $("#clueForm").fadeIn();
                }
                break;
            case "bye":
                updatePlayers(jsonMessage.data["players"]);
                if (jsonMessage.data["stopGame"]) {
                    stopGame()
                    displayNotification("Game aborted due to player disconnect");
                }
                break;
            case "gameFull":
                if (jsonMessage.userID === userID) {
                    displayNotification("Game already running -- try again when it's over");
                    conn.close();
                }
                break;
            case "pong":
                break;
            default:
                console.error(`illegal game update type ${jsonMessage.updateType}`)
        }
    }

    function updateTurn(player) {
        turn = player.userID;
        $("#turn").text(`${player.userID}${turn === userID ? " (you)" : ""}`);
        displayNotification(`${player.userID}'s turn begins - ${player.role === "GUESSER" ? "make guesses" : "give a clue"}!`);
        const clueForm = $("#clueForm");
        if (turn === userID) {
            if (player.role === "CLUE_GIVER") {
                clueForm.fadeIn();
            }
        }
    }

    function updatePlayers(playerData) {
        console.log("player info:", playerData);
        const playerTable = $("#players");
        let playerHTML = "";
        playerHTML += "<tr><th>Players</th></tr>";
        for (let i = 0; i < REQUIRED_PLAYERS; i++) {
            if (`${i}` in playerData) {
                const info = playerData[i];
                if (info.userID === userID) {
                    role = info.role;
                    console.log(`got role of ${role}`);
                }
                playerHTML += `<tr class="player" style="background-color: ${info.color.toLowerCase()}">`;
                playerHTML += `<td>${i + 1}: ${info.userID}${("role" in info) ? ` - ${info["role"]}` : ""}${info.userID === userID ? " (you)" : ""}</td>`
            } else {
                playerHTML += '<tr class="player">';
                playerHTML += `<td class="placeholder">${i + 1}: waiting for player...</td>`;
            }
            playerHTML += "</tr>";
        }
        playerTable.html(playerHTML);
    }

    function updateGame(boardData) {
        $("#clueContainer").fadeOut();
        const dim = Math.sqrt(Object.keys(boardData).length);
        const board = $("#board");
        board.hide();
        board.html("");
        let row = "";
        for (let i = 0; i < dim ** 2; i++) {
            if (i % dim === 0) {
                // start new row
                if (i > 0) {
                    row += "</tr>";
                    board.append(row);
                }
                row = "<tr>";
            }
            row += `<td id="square-${i}" class="square">${boardData[i]["word"]}</td>`;
        }
        row += "</tr>";
        board.append(row);
        board.fadeIn("slow");

        const percentageSpace = 100 / dim;
        const squares = $(".square");
        squares.css({"min-width": `${percentageSpace}%`, "height": `${percentageSpace}%`});
        squares.click(function () {
            sendGameUpdate("guess", {index: parseInt($(this).attr("id").replace("square-", ""))});
        });

        displayNotification("Beginning a new game");
    }

    function displayNotification(message) {
        const notifyBar = $("#notification");
        notifyBar.text(message);
        notifyBar.show();
        setTimeout(function () {
            notifyBar.fadeOut();
        }, 3 * SECOND);
    }

    function stopGame() {
        turn = -1;
    }

    $("#submitClue").click(function () {
        const clue = $("#clue");
        const number = $("#number");
        console.log("sending clue over")
        sendGameUpdate("clue", {clue: clue.val(), numGuesses: number.val()});
        $("#clueForm").fadeOut("default", function () {
            clue.val("");
            number.val("");
        });
    });


    let userID = Math.floor(Math.random() * 2 ** 31 - 1) + 1;
    let turn = -1;
    let role = ""


    displayNotification("Game loaded");
});