$(document).ready(function () {
    const SECOND = 1000;
    const REQUIRED_PLAYERS = 4;
    const NOTIFICATIONS = 5;

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
        sendGameUpdate("hello", {startNew: false});
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

    conn.onerror = (error) => console.error(error);

    $(window).on('beforeunload', function () {
        sendGameUpdate("bye");
        conn.close();
    });

    function sendGameUpdate(updateType, data = null) {
        const jsonMessage = {updateType: updateType, userID: userID, data: data};
        if (conn.readyState !== WebSocket.OPEN) {
            console.error("cannot send message as WebSocket is not open", jsonMessage);
            return;
        }
        const message = JSON.stringify(jsonMessage);
        console.log("sending message to server:", jsonMessage);
        conn.send(message);
    }

    function receiveGameUpdate(jsonMessage) {
        console.log("received message from server:", jsonMessage);
        switch (jsonMessage.updateType) {
            case "hello":
                // handle reconnect on new game start
                let includesMe = false;
                jsonMessage.data["players"].forEach(function (player) {
                    if (player.userID === userID) {
                        includesMe = true;
                    }
                });
                if (!includesMe) {
                    location.reload();
                }
                updatePlayers(jsonMessage.data["players"]);
                if (jsonMessage.data["data"] != null) {
                    updateGame(jsonMessage.data["data"]);
                }
                if (jsonMessage.data["turn"] != null) {
                    updateTurn(jsonMessage.data["turn"]);
                }
                break;
            case "guessResult":
                if (jsonMessage.data["valid"]) {
                    const index = jsonMessage.data["index"];
                    if (index !== -1) {
                        const square = $(`#square-${index}`);
                        square.addClass(jsonMessage.data["color"].toLowerCase());
                        const wordContainer = square.children(".word");
                        wordContainer.css({color: "grey"});
                        displayNotification(`Player ${userID} guessed the word '${wordContainer.text()}' ${jsonMessage.data["correct"] ? "" : "in"}correctly!`);
                        if (jsonMessage.data["color"] === "BLACK") {
                            displayNotification(`Player ${userID} selected the assassin!`);
                        }
                        $("#guessesDisplay").text(jsonMessage.data["guessesRemaining"]);
                        if (jsonMessage.data["winner"] != null) {
                            displayNotification(`${jsonMessage.data["winner"]} team wins!`);
                            stopGame();
                            break;
                        }
                    }
                    if (jsonMessage.data["guessesRemaining"] < 1) {
                        displayNotification("Guessing done");
                        $("#stopGuessing").fadeOut();
                        $("#guessesContainer").fadeOut();
                        $("#clueContainer").fadeOut();
                        updateTurn(jsonMessage.data["turn"]);
                    }
                }
                break;
            case "clue":
                if (jsonMessage.data["valid"]) {
                    updateTurn(jsonMessage.data["turn"]);
                    displayNotification(`clue given: ${jsonMessage.data.clue}, ${jsonMessage.data.numGuesses - 1} (${jsonMessage.data.numGuesses} guesses)`);
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
                    const aborted = turn !== -1;
                    stopGame();
                    if (aborted) {
                        displayNotification("Game aborted due to player disconnect");
                    }
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
        const turnDisplay = $("#turn");
        turnDisplay.removeClass("blue red");
        turnDisplay.addClass(player.color.toLowerCase());
        $("#turnContainer").fadeIn();
        const me = turn === userID
        if (me) {
            turnDisplay.text(`You (${player.userID})`);
            turnDisplay.css({"font-weight": "bold"});
            displayNotification(`Your turn has started — ${player.role === "GUESSER" ? "make guesses" : "give a clue"}!`);
            if (player.role === "CLUE_GIVER") {
                $("#clueForm").fadeIn();
            } else {
                $("#stopGuessing").fadeIn();
            }
        } else {
            turnDisplay.text(`${player.userID}`);
            turnDisplay.css({"font-weight": "normal"});
            displayNotification(`${player.userID}'s turn has started`);
        }
    }

    function updatePlayers(playerData) {
        let playerHTML = "";
        playerHTML += "<tr style='background-color:slategrey'><th>Players</th></tr>";
        for (let i = 0; i < REQUIRED_PLAYERS; i++) {
            if (`${i}` in playerData) {
                const info = playerData[i];
                if (info.userID === userID) {
                    role = info.role;
                }
                playerHTML += `<tr class="player ${info.color.toLowerCase()}">`;
                playerHTML += `<td>${i + 1}: ${info.userID}${("role" in info) ? ` — ${info["role"] === "GUESSER" ? "guesser" : "clue-giver"}` : ""}${info.userID === userID ? " (you)" : ""}</td>`
            } else {
                playerHTML += '<tr class="player">';
                playerHTML += `<td class="placeholder">${i + 1}: waiting for player...</td>`;
            }
            playerHTML += "</tr>";
        }
        $("#players").html(playerHTML);
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
            row += `<td id="square-${i}" class="square ${role === "CLUE_GIVER" ? boardData[i]["color"].toLowerCase() : ""}"><span class="word">${boardData[i]["word"]}</span></td>`;
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
        if (notifications.length > NOTIFICATIONS) {
            notifications.shift();
        }
        notifications.push(message);
        const notifyBar = $("#notifications");
        let notificationsHtml = "";
        notifications.forEach(function (notification, index) {
            notificationsHtml += `<div>${notification}</div>`;
        });
        notifyBar.html(notificationsHtml);
        notifyBar.show();
    }

    function stopGame() {
        turn = -1;
        $("#turnContainer").hide();
    }

    $("#newGame").click(function () {
        sendGameUpdate("hello", {startNew: true});
        location.reload();
    });

    $("#stopGuessing").click(function () {
        sendGameUpdate("guess", {index: -1});
    });

    $("#submitClue").click(function () {
        const clue = $("#clue");
        const number = $("#number");
        sendGameUpdate("clue", {clue: clue.val(), numGuesses: number.val()});
        $("#clueForm").fadeOut("default", function () {
            clue.val("");
            number.val("");
        });
    });


    let userID = Math.floor(Math.random() * 2 ** 31 - 1) + 1;
    let turn = -1;
    let role = "";
    let notifications = []

    displayNotification("Game loaded! Word lists are fetched using the Wordnik API");
});
