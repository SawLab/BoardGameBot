var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var sqlite3 = require('sqlite3').verbose();

const MAX_GAME_NAME_LENGTH = 32;
const MAX_NICKNAME_LENGTH = 10;
const MAX_USERNAME_LENGTH = 32;
const MIN_USERNAME_LENGTH = 2;

var db = new sqlite3.Database('./BoardGameBot.db', (err) => {
	if (err)
	{
		return console.error(err.message);
	}
	console.log('Connected to BoardGameBot database');
});
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', function (user, userID, channelID, message, evt) {
	
	// Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd1 = args[0].toLowerCase();
		var cmd2 = args[1];
		var cmd3 = args[2];
       
        args = args.splice(1);
        switch(cmd1) {
            case 'ping':
                Ping(channelID);
				break;
			case 'help':
				Help(channelID);
				break;
			case 'leaderboard': 	
				Leaderboard(channelID, cmd2);
				break;				
			case 'addme':
				AddMe(user, userID, channelID);
				break;
			case 'removeme':
				RemoveMe(user, userID, channelID);
				break;
			case 'win':
				AddWin(user, userID, channelID, cmd2);
				break;
			case 'loss':
				AddLoss(user, userID, channelID, cmd2);
				break;			
			case 'myscore':
				ViewMyScore(userID, channelID, cmd2);
				break;
			case 'namechange':
				ChangeUserName(userID, channelID);
				break;
			case 'source':
				ViewSourceCode(channelID);
				break;
			case 'deleteallusers':
				DeleteUsers(userID, channelID);
				break;
			case 'addgame':
				AddGame(userID, channelID, cmd2, cmd3);
				break;
			case 'viewgames':
				ViewGames(channelID);
				break;
			case 'admin':
				ViewAdminCommands(channelID);
				break;
			case 'addwin':
				AddUserWin(userID, channelID, cmd2, cmd3);
				break;
			case 'addloss':
				AddUserLoss(userID, channelID, cmd2, cmd3);
				break;
			case 'deleteuser':
				DeleteUser(userID, channelID, cmd2);
				break;
			case 'updategamename':
				UpdateGameName(userID, channelID, cmd2, cmd3);
				break;
			case 'updatenickname':
				UpdateNickname(userID, channelID, cmd2, cmd3);
				break;
			default:
				IncorrectCommand(channelID);
				break;
         }
     }
});

//Decides whether to print the leaderboard for total wins or specific game wins
function Leaderboard(channelID, game)
{
	if (game == null) {
		TotalWinsLeaderboard(channelID);
	}
	else {
		GameWinsLeaderboard(channelID, game);
	}
}

//Prints the top 5 players for the selected game
function GameWinsLeaderboard(channelID, game)
{
	var gameName;
	
	game = game.toLowerCase();
	
	db.serialize(function() {
		let sql = `SELECT gameName FROM Games WHERE nickName = ?`;
		db.get(sql, [game], function(err, row) { 				//First check to make sure the game exists and grab its full name.
			if(err) {
				return console.error(err.message);
			}
			if (row == null) {
				let message = "Invalid nickname. Type !viewgames for a list of valid nicknames.";
				return SendMessageToServer(message, channelID);
			}
			gameName = row.gameName;
			sql = `SELECT userName user, ${game} wins FROM Users ORDER BY wins DESC`
				db.all(sql,
				(error, rows) => {
					if (error) {
						console.error(error.message);
					}
					var messageToSend = `Top ${gameName} winners:\n`;
					var i = 1;
					var numToPrint = rows.length < 6 ? rows.length + 1 : 6; //print the top 5 scores; if less than 5 users print the same number as the number users
					
					rows.forEach(row => {
						if (i < numToPrint) {
						messageToSend = `${messageToSend}${i}: ${row.user} - ${row.wins}\n`;
							i++;
						}
					});
					
					SendMessageToServer(messageToSend, channelID);	
			});
		});		
	});
}

//Prints the top 5 users. Prints less than 5 if there are less than 5 users.
function TotalWinsLeaderboard(channelID) {
	db.serialize(function() {
		db.all("SELECT userName user, totalWins wins FROM Users ORDER BY totalWins DESC",
			(error, rows) => {
				if (error) {
					console.error(error.message);
				}
				var messageToSend = "Top winners across all games:\n";
				var i = 1;
				var numToPrint = rows.length < 6 ? rows.length + 1 : 6; //print the top 5 scores; if less than 5 users print the same number as the number users
				
				rows.forEach(row => {
					if (i < numToPrint) {
					messageToSend = `${messageToSend}${i}: ${row.user} - ${row.wins}\n`;
						i++;
					}
				});
				
				SendMessageToServer(messageToSend, channelID);	
		});
	});
}

//Increments the user's total wins and the wins of the specified game by 1
function AddWin(user, userID, channelID, gameNickName)
{
	if (gameNickName == null) {
		let message = "The nickname for the game must be specfied. Type !viewgames to see a list of games and their nicknames. Format: !win {nickname}";
		SendMessageToServer(message, channelID);
		return;
	}
	
	db.serialize(function() {
		gameNickName = gameNickName.toLowerCase();
		var totalWins;
		var gameWins;
		var gameName;
		
		let sql = `SELECT totalWins wins FROM Users WHERE userID = ?`; //Find total wins first to make sure user is in the system
			db.get(sql, [userID], (err, row) => {
			if (row == null) {
				let message = `${user} is not in my system! Type !addme to add yourself.`; 
				SendMessageToServer(message, channelID);
				return;
			}
			if(err) {
				return console.error(err.message);
			}
			totalWins = row.wins;
			totalWins = totalWins + 1; //reduce player's total win count by 1

			sql = `SELECT ${gameNickName} game FROM Users WHERE userID = ?`;	//Find game wins to check that the specified game is in the system.
			db.get(sql, [userID], (err, row) => {
				if (row == null) {
					let message = `${gameNickName} is not a valid nickname. Type !viewgames for a list of valid nicknames.`;
					SendMessageToServer(message, channelID);
					return;
				}
				if(err) {
					return console.error(err.message);
				}

				gameWins = row.game;						
				gameWins = gameWins + 1;   //reduce player's specified game win count by 1 
				
				sql = `UPDATE Users SET totalWins = ?, ${gameNickName} = ? WHERE userID = ?`;
	
				db.run(sql, [totalWins, gameWins, userID], function(err) {		//now we can update to the new values now that we know the user and game are both in the system
					if (err) {
						return console.error(err.message);
					}
					sql = `SELECT gameName FROM Games WHERE nickName = ?`;
					db.get(sql, [gameNickName], function(err, row) {
						if (err) {
							return console.error(err.message);
						}
						let message = `Congratulations ${user}! You now have ${gameWins} wins in ${row.gameName} and your total wins are now ${totalWins}.`;
						SendMessageToServer(message, channelID);
					});
				});
			});			
		});						
	});
}

//Reduces the user's total wins and the wins of the specified game by 1
function AddLoss(user, userID, channelID, gameNickName)
{
	if (gameNickName == null) {
		let message = "The nickname for the game must be specfied. Type !viewgames to see a list of games and their nicknames. Format: !win {nickname}";
		SendMessageToServer(message, channelID);
		return;
	}
	
	db.serialize(function() {
		gameNickName = gameNickName.toLowerCase();
		var totalWins;
		var gameWins;
		var gameName;
		
		let sql = `SELECT totalWins wins FROM Users WHERE userID = ?`; //Find total wins first to make sure user is in the system
			db.get(sql, [userID], (err, row) => {
			if (row == null) {
				let message = `${user} is not in my system! Type !addme to add yourself.`; 
				SendMessageToServer(message, channelID);
				error = true;
				return;
			}
			if(err) {
				error = true;
				return console.error(err.message);
			}
			totalWins = row.wins;
			totalWins = totalWins - 1; //reduce player's total win count by 1

			if (totalWins < 0) {
				let message = 'Error: User can not have less than 0 total wins.';
				return SendMessageToServer(message, channelID);
			}

			sql = `SELECT ${gameNickName} game FROM Users WHERE userID = ?`;	//Find game wins to check that the specified game is in the system.
			db.get(sql, [userID], (err, row) => {
				if (row == null) {
					let message = `${gameNickName} is not a valid nickname. Type !viewgames for a list of valid nicknames.`;
					SendMessageToServer(message, channelID);
					error = true;
					return;
				}
				if(err) {
					error = true;
					return console.error(err.message);
				}
				gameWins = row.game;						
				gameWins = gameWins - 1;   //reduce player's specified game win count by 1 

				if (gameWins < 0) {
					let message = 'Error: User can not have less than 0 game wins.';
					return SendMessageToServer(message, channelID);
				}
				
				sql = `UPDATE Users SET totalWins = ?, ${gameNickName} = ? WHERE userID = ?`;
	
				db.run(sql, [totalWins, gameWins, userID], function(err) {		//now we can update to the new values now that we know the user and game are both in the system
					if (err) {
						return console.error(err.message);
					}
					sql = `SELECT gameName FROM Games WHERE nickName = ?`;
					db.get(sql, [gameNickName], function(err, row) {
						if (err) {
							return console.error(err.message);
						}
						let message = `${user} now has ${gameWins} wins in ${row.gameName} and their total wins have been reduced to ${totalWins}.`;
						SendMessageToServer(message, channelID);
					});
				});
			});			
		});						
	});
}

//Adds the user to the database. If user already exists, let the user know.
function AddMe(user, userID, channelID)
{
	db.serialize(function() {
		var userDiscriminator = GetUserByID(userID).discriminator;
		db.run('INSERT INTO Users(userID, userName, userDiscriminator) VALUES(?, ?, ?)', [userID, user, userDiscriminator], function(err) {
			if(err)
			{
				if(err.message.includes("SQLITE_CONSTRAINT"))
				{
					let message = "You already exist in my system!";
					SendMessageToServer(message, channelID);
				}
				return console.error(err.message);
			}
			let message = `Welcome ${user}! You are now ready to start tracking your wins!`;
			SendMessageToServer(message, channelID);
		});
	});
}

//Allows the player to remove themeselves from the database
function RemoveMe(user, userID, channelID)
{
	let sql = `SELECT userName FROM Users WHERE userID = ?`;
	db.get(sql, [userID], function(err,row) {
		if (row == null) {
			let message = "You must first type !addme before you can delete yourself!"
			return SendMessageToServer(message, channelID);
		}
		if (err) {
			return console.error(err.message);
		}
		
		sql = 'DELETE FROM Users WHERE userID = ?';
		db.run(sql, [userID], function(err) {
			if (err) {
				return console.error(err.message);
			}
			let message = `${user} has been deleted from the database.`
						+ `\nSorry to see you go... ;_;`;
			SendMessageToServer(message, channelID);
		});
	});	
}

//Pings the bot
function Ping(channelID)
{
	let message = 'Pong';
	SendMessageToServer(message, channelID);
}

//Prints message if command is not recognized.
function IncorrectCommand(channelID)
{
	let message = 'Command not recognized. Type !help for a list of approved commands.';
	SendMessageToServer(message, channelID);
}

//Prints all the approved commands in the channel
function Help(channelID)
{
	let message = 'Approved Commands:'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!addme - adds you to the database so you can start tracking your wins!'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!leaderboard - prints the top 5 users across all games'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!leaderboard {nickname} - prints the top 5 users for the specified game'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!win {nickname} - adds a win to your account for the specified game'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!myscore - view your total wins'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!myscore {nickname} - view your total wins for the specified game'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!viewgames - view list of all games and their nicknames'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!namechange - enter this command if you\'ve changed your Discord username after adding yourself to my system'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!source - view my source code'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!admin - view admin commands'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!help - prints the help screen';
	SendMessageToServer(message, channelID);
}

//Retrieves the full user object
function GetUserByID(userID)
{
	var user = bot.users[userID];
	return user;
}

//Sends a message to the desgignated channel
function SendMessageToServer(messageToSend, channelID)
{
	bot.sendMessage({
		to: channelID,
		message: messageToSend
	});
}

//Decides to either print the user's total wins or the user's wins for the specified game
function ViewMyScore(userID, channelID, game)
{
	if (game == null) {
		ViewMyTotalScore(userID, channelID);
	}
	else {
		ViewMyGameScore(userID, channelID, game);
	}
}

//Allows the user to view their total wins for the specified game
function ViewMyGameScore(userID, channelID, game)
{
	game = game.toLowerCase();
	var gameName;
	
	let sql = `SELECT gameName FROM Games WHERE nickName = ?`;	//Check if the game exists, if so grab its full name
	db.get(sql, [game], function(err, row) {
		if (row == null) {
			let message = "Invalid nickname. Type !viewgames for a list of valid nicknames.";
			return SendMessageToServer(message, channelID);
		}
		if (err) {
			return console.error(err.message);
		}
		gameName = row.gameName;
		
	    sql = `SELECT userName user, ${game} wins FROM Users WHERE userID = ?`;
		db.get(sql, [userID], function(err, row) {
			let message = `${row.user} has ${row.wins} wins for ${gameName}. `;
			SendMessageToServer(message, channelID);
		});
	});	
}

//Allows the user to view personal total wins score.
function ViewMyTotalScore(userID, channelID)
{
	let sql = "SELECT userName user, totalWins wins FROM Users WHERE userID = ?";
	db.get(sql, [userID], function(err, row) {
		if(err)	{
			return console.error(err.message);
		}
		let message = `Total wins for ${row.user} is: ${row.wins}`;
		SendMessageToServer(message, channelID);
	});
}

//Allows the user to change their name in the database if their Discord username is changed.
function ChangeUserName(userID, channelID)
{
	db.serialize(function() {
		var user = GetUserByID(userID);
		var newName = user.username;
		var newDiscriminator = user.discriminator;
		
		let sql = "SELECT userName name, userDiscriminator discriminator FROM Users WHERE userID = ?";
		
		db.get(sql, [userID], function(err, row) {
			if(err) {
				return console.error(err.message);
			}

			if(row == null) {	//if row does not exist, prompt user to add themeselves into te database
				let message = "I don't recognize you! Type !addme to be added to my database.";
				SendMessageToServer(message, channelID);
				return;
			}
			var prevName = row.name;
			var prevDiscriminator = row.discriminator;
			
			if(prevName === newName && prevDiscriminator === newDiscriminator) {		//if name has not changed: return. No need to update.
				let message = "You are up to date in my system. No change needed!";
				SendMessageToServer(message, channelID);
				return;
			}
			
			sql = "UPDATE Users SET userName = ?, userDiscriminator = ? WHERE userID = ?";
			db.run(sql, [newName, newDiscriminator, userID], function(err) {
				if(err) {
					return console.error(err.message);
				}
				let message = `Name successfully changed from ${prevName}#${prevDiscriminator} to ${newName}#${newDiscriminator}`;
				SendMessageToServer(message, channelID);
			});
		});
	});
}

//Print the link to the source code for this bot
function ViewSourceCode(channelID)
{
	let message = 'Enter my secret chambers...'
				+ '\nhttps://github.com/SawLab/BoardGameBot/blob/master/bot.js';
	SendMessageToServer(message, channelID);
}

//Prints list of all games and their nicknames
function ViewGames(channelID)
{
	let sql = 'SELECT gameName name, nickName nick FROM Games ORDER BY gameName ASC';
	
	db.all(sql, [], function(err, rows) {
		if (err) {
			return console.error(err.message);
		}
		
		if (rows == null) {
			let message = "No games to view. Admin must add a board game using the !addgame command."
			SendMessageToServer(message, channelID);
		}
		
		let message = "";
		rows.forEach(row => {
			message = `${message}${row.name}: ${row.nick}\n`;	
		});		
		SendMessageToServer(message, channelID);
	});
}

//Prints list of commands only the admin can use
function ViewAdminCommands(channelID)
{
	let message = 'Admin Commands:'
				+ '\n\t\t\t\t\t\t\t\t\t!addgame {Board&Game&Name} {nickname} - adds a game to the game list and begins tracking wins for all users'
				+ '\n\t\t\t\t\t\t\t\t\t!addwin {username#1234} {nickname} - remove a win from the selected user'
				+ '\n\t\t\t\t\t\t\t\t\t!addloss {username#1234} {nickname} - add a win from the selected user'
				+ '\n\t\t\t\t\t\t\t\t\t!deleteuser {username#1234} - delete the specified user from the database'
				+ '\n\t\t\t\t\t\t\t\t\t!deleteallusers - DELETES ALL USERS FROM THE DATABASE. BIG NO NO'
				+ '\n\t\t\t\t\t\t\t\t\t!updategamename {nickname} {New&Game&Name} - updates the name of an existing game'
				+ '\n\t\t\t\t\t\t\t\t\t!updatenickname {oldnickname} {newnickname} - updates the nickname of an existing game';
	SendMessageToServer(message, channelID);
}

//Admin only. Add Game to the Games table, add the new game to the User table as a column.
function AddGame(userID, channelID, gameName, nickName)
{
	
	if (gameName == null) {
		let message = "Game name not specified. Command must be !addgame {gameName} {nickname}. Use \'&\' instead of spaces for the game name.";
		SendMessageToServer(message, channelID);
		return;
	}
	
	if (gameName.length > 32) {
		let message = "The game name cannot be larger than 32 characters. Please shorten the game name.";
		SendMessageToServer(message, channelID);
		return;
	}
	
	if (nickName == null) {
		let message = "Nickname not specified.  Command must be !addgame {gameName} {nickname}.";
		SendMessageToServer(message, channelID);
		return;
	}
	
	if (nickName.length > 10) {
		let message = "The nickname cannot be larger than 10 characters. Please shorten the nickname.";
		SendMessageToServer(message, channelID);
		return;
	}
	
	var name = gameName.replace(/&/g, ' ');
	
	if (auth.adminID != userID)	//if user is not authorised admin, return
	{
		let message = "You can't tell me to what to do!";
		SendMessageToServer(message, channelID);
		return;		
	}	
	
	db.serialize(function() {
		let sql = 'INSERT INTO Games(gameName, nickName) VALUES(?, lower(?))';
		db.run(sql, [name, nickName], function(err) {
			if (err) {
				if(err.message.includes("SQLITE_CONSTRAINT"))
				{
					let message = "This game name or nickname already exists in my system!";
					SendMessageToServer(message, channelID);
				}
				return console.error(err.message);
			}

			nickName = nickName.toLowerCase();
			sql = `ALTER TABLE Users ADD COLUMN ${nickName} int DEFAULT 0`;
			db.run(sql, [], function(err) {
				if (err) {
					return console.error(err.message);
				}
				let message = `${name} with nickname ${nickName} has been added.`;
				SendMessageToServer(message, channelID);
			});
		});
	});
}

//Admin only. Adds a player win to the specified user and game.
function AddUserLoss(userID, channelID, userToEdit, game)
{
	var userToEditSplit;
	var userToEditName;
	var userToEditDiscriminator;
	var userToEditID;
	
	if (userID != auth.adminID) {	//check for admin permissions
		let message = 'You can\'t tell me what to do!';
		return SendMessageToServer(message, channelID);
	}
	
	if (userToEdit == null) {
		let message = 'Missing the user to edit. Format: !addloss {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	if (game == null) {
		let message = 'Missing game. Format: !addloss {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}	

	userToEditSplit = userToEdit.split('#');
	userToEditName = userToEditSplit[0];
	userToEditDiscriminator = userToEditSplit[1];
	
	if (userToEditSplit.length != 2 || userToEditDiscriminator.length != 4) { //check that user input is correct format
		let message = 'Invalid user format. Format: !addloss {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	if (userToEditName.length < 2 || userToEditName.length > 32) {	//check to make sure its a name Discord allows
		let message = 'Invalid user length. Username must be between 2 and 32 characters. Format: !addloss {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	let sql = `SELECT userID from Users WHERE userName = ? AND userDiscriminator = ?`; //find unique userID using username and discriminator
	db.get(sql, [userToEditName, userToEditDiscriminator], function(err, row) {
		if (err) {
			return console.error(err.message);
		}		
		if (row == null) {
			let message = `${userToEdit} is not in my system!`;
			return SendMessageToServer(message, channelID);
		}
		userToEditID = row.userID;
		game = game.toLowerCase();
		AddLoss(userToEditName, userToEditID, channelID, game); //call the AddLoss function with the gathered data
	});	
}

//Admin only. Adds a player win to the specified user and game.
function AddUserWin(userID, channelID, userToEdit, game)
{
	var userToEditSplit;
	var userToEditName;
	var userToEditDiscriminator;
	var userToEditID;
	
	if (userID != auth.adminID) {
		let message = 'You can\'t tell me what to do!';
		return SendMessageToServer(message, channelID);
	}
	
	if (userToEdit == null) {
		let message = 'Missing the user to edit. Format: !addwin {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	if (game == null) {
		let message = 'Missing game. Format: !addwin {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}	

	userToEditSplit = userToEdit.split('#');
	userToEditName = userToEditSplit[0];
	userToEditDiscriminator = userToEditSplit[1];
	
	if (userToEditSplit.length != 2 || userToEditDiscriminator.length != 4) {	//Check that user input is correct format
		let message = 'Invalid user format. Format: !addwin {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	if (userToEditName.length < 2 || userToEditName.length > 32) {  //Check to make sure its a name Discord allows
		let message = 'Invalid user length. Username must be between 2 and 32 characters. Format: !addwin {username#1234} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	let sql = `SELECT userID from Users WHERE userName = ? AND userDiscriminator = ?`;
	db.get(sql, [userToEditName, userToEditDiscriminator], function(err, row) {    //find unique userID using username and discriminator
		if (err) {
			return console.error(err.message);
		}		
		if (row == null) {
			let message = `${userToEdit} is not in my system!`;
			return SendMessageToServer(message, channelID);
		}
		userToEditID = row.userID;
		game = game.toLowerCase();
		AddWin(userToEditName, userToEditID, channelID, game); //Call the AddWin function with the gathered data
	});	
}

//Admin only. Delete another user from the system
function DeleteUser(userID, channelID, userToDelete)
{
	var userToDeleteSplit;
	var userToDeleteName;
	var userToDeleteDiscriminator;
	
	if (userID != auth.adminID) { //check if user is admin
		let message = 'You can\'t tell me what to do!';
		return SendMessageToServer(message, channelID);
	}
	
	if (userToDelete == null) {
		let message = 'Missing user to delete. Format: !deleteuser {username#1234}';
		return SendMessageToServer(message, channelID);
	}
	
	userToDeleteSplit = userToDelete.split('#');
	userToDeleteName = userToDeleteSplit[0];
	userToDeleteDiscriminator = userToDeleteSplit[1];
	
	if (userToDeleteSplit.length != 2 || userToDeleteDiscriminator.length != 4) { //check input formatting
		let message = 'Invalid user format. Format: !deleteuser {username#1234}';
		return SendMessageToServer(message, channelID);
	}
	
	if (userToDeleteName.length < 2 || userToDeleteName.length > 32) { //check if the inputted name is allowed on Discord
		let message = 'Invalid user. User must be between 2 and 32 characters. Format: !deleteuser {username#1234}';
		return SendMessageToServer(message, channelID);
	}
	
	let sql = `SELECT userID From Users WHERE userName = ? AND userDiscriminator = ?`;
	db.get(sql, [userToDeleteName, userToDeleteDiscriminator], function(err, row) {	//check if the user to delete is in the database
		if (row == null) {
			let message = `${userToDelete} does not exist in my system!`;
			return SendMessageToServer(message, channelID);
		}
		sql = `DELETE FROM Users WHERE userName = ? AND userDiscriminator = ?`;		//then delete the selected user
		db.run(sql, [userToDeleteName, userToDeleteDiscriminator], function(err) {
			if (err) {
				return console.error(err.message);
			}
			let message = `User ${userToDelete} has been deleted.`;
			SendMessageToServer(message, channelID);
		});
	});
}

//Admin only. WIPES ENTIRE USER DATABASE
function DeleteUsers(userID, channelID)
{
	if (userID != auth.adminID) {
		let message = 'WHAT DO YOU THINK YOU\'RE DOING? ONLY ADMINS CAN DO THAT!';
		return SendMessageToServer(message, channelID);
	}
	
	let sql = "DELETE FROM Users";
	let message = "All user data deleted";
	db.run(sql, [], function(err) {
		if (err) {
			return console.error(err.message);
		}
		SendMessageToServer(message, channelID);
	});
}

//Admin only. Update the gameName of an existing game in the database
function UpdateGameName(userID, channelID, nickName, newGameName)
{
	var oldGameName;
	
	if (userID != auth.adminID) {	//check for admin permissions
		let message = 'You can\'t tell me what to do!';
		return SendMessageToServer(message, channelID);
	}
	
	if (nickName == null) {
		let message = `Nickname for the game is missing. Format: !updategamename {nickname} {New&Game&Name}`;
		return SendMessageToServer(message, channelID);
	}
	
	if (newGameName == null) {
		let message = `The new name for the game is missing. Format: !updategamename {nickname} {New&Game&Name}`;
		return SendMessageToServer(message, channelID);
	}

	if (nickName.length > MAX_NICKNAME_LENGTH) {
		let message = `The length of the nickname cannot be larger than ${MAX_NICKNAME_LENGTH} characters. Format: !updategamename {nickname} {New&Game&Name}`;
		return SendMessageToServer(message, channelID);
	}
	
	if (newGameName.length > MAX_GAME_NAME_LENGTH) {
		let message = `The length of the game name cannot be larger than ${MAX_GAME_NAME_LENGTH} characters. Format: !updategamename {nickname} {New&Game&Name}`;
		return SendMessageToServer(message, channelID);
	}
	
	newGameName = newGameName.replace(/&/g, ' ');
	
	let sql = 'SELECT gameName FROM Games Where nickName = ?';
	db.get(sql, [nickName], function(err, row) {
		if (row == null) {
			let message = 'That nickname does not exist in my system. Type !viewgames for a list of valid nicknames';
			return SendMessageToServer(message, channelID);
		}
		oldGameName = row.gameName;
		
		sql = 'UPDATE Games SET gameName = ? WHERE nickName = lower(?)'
		db.run(sql, [newGameName, nickName], function(err) {
			if (err) {
				return console.error(err.message);
			}
			let message = `'${oldGameName}' successfully changed to '${newGameName}'`;
			SendMessageToServer(message, channelID);
		});
	});
}

function UpdateNickname(userID, channelID, oldNickName, newNickName)
{
	if (userID != auth.adminID) {	//check for admin permissions
		let message = 'You can\'t tell me what to do!';
		return SendMessageToServer(message, channelID);
	}
	
	if (oldNickName == null)
	{
		let message = 'The current nickname is missing. Format: !updatenickname {oldNickName} {newNickName}';
		return SendMessageToServer(message, channelID);
	}
	
	if (newNickName == null)
	{
		let message = 'The new nickname is missing. Format: !updatenickname {oldNickName} {newNickName}';
		return SendMessageToServer(message, channelID);
	}
	
	if (newNickName.length > MAX_NICKNAME_LENGTH)
	{
		let message = 'The new nickname cannot be greater than ${MAX_NICKNAME_LENGTH}.';
		return SendMessageToServer(message, channelID);
	}
	
	let sql = 'UPDATE Games SET nickName = ? WHERE nickName = ?';
	db.run(sql,[newNickName, oldNickName], function(err) {
		if (err) {
			return console.error(err.message);
		}
		sql = `ALTER TABLE Users RENAME COLUMN ${oldNickName} TO ${newNickName}`;
		db.run(sql, [], function(err) {
			if (err) {
				if(err.message.includes("SQLITE_CONSTRAINT"))
				{
					let message = "This nickname already exists in my system!";
					SendMessageToServer(message, channelID);
				}
				return console.error(err);
			}
			
			sql = 'SELECT gameName FROM Games WHERE nickName = ?';
			db.get(sql, [newNickName], function(err, row) {
				if (row == null) {
					let message = "Error: Could not validate nickname has changed.";
					SendMessageToServer(message, channelID);
				}
			let message = `The nickname for ${row.gameName} has successfully changed from ${oldNickName} to ${newNickName}`
			SendMessageToServer(message, channelID);
			});
		});
	});
}