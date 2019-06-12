var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

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

bot.on('guildMemberAdd', function (member)
{
	var mentionNewUser = member.username + '#' + member.discriminator;
	let message = `Welcome <@!${member.id}>! Type !addme to get started or !help to see all my commands.`;
	SendMessageToServer(message, auth.channelID);
});

bot.on('message', function (user, userID, channelID, message, evt) {
	// Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
	console.log(message);
	console.log(auth.adminIDs);
    if (message.substring(0, 1) == '!') {
		
		if (channelID in bot.directMessages) {	//block direct message commands
			let message = 'Your attempts to be sneaky are futile. My commands only work in the main channel.';
			return SendMessageToServer(message, channelID);
		}
		
        var args = message.substring(1).split(' ');
        var cmd0 = args[0].toLowerCase();
		console.log('cmd0: ' + cmd0);
		var cmd1 = args[1];
		console.log('cmd1: ' + cmd1);
		var cmd2 = args[2];
		console.log('cmd2: ' + cmd2);
       
        args = args.splice(1);
        switch(cmd0) {
            case 'ping':
                Ping(channelID);
				break;
			case 'help':
				Help(channelID);
				break;
			case 'leaderboard': 	
				Leaderboard(channelID, cmd1);
				break;				
			case 'addme':
				AddMe(user, userID, channelID);
				break;
			case 'removeme':
				RemoveMe(userID, channelID);
				break;
			case 'win':
				AddWin(userID, channelID, cmd1);
				break;
			case 'loss':
				AddLoss(userID, channelID, cmd1);
				break;			
			case 'myscore':
				ViewMyScore(userID, channelID, cmd1);
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
				AddGame(userID, channelID, cmd1, cmd2);
				break;
			case 'viewgames':
				ViewGames(channelID);
				break;
			case 'admin':
				ViewAdminCommands(channelID);
				break;
			case 'givewin':
				GiveUserWin(userID, channelID, cmd1, cmd2);
				break;
			case 'giveloss':
				GiveUserLoss(userID, channelID, cmd1, cmd2);
				break;
			case 'deleteuser':
				DeleteUser(userID, channelID, cmd1);
				break;
			case 'deletegame':
				DeleteGame(userID, channelID, cmd1);
				break;
			case 'updategamename':
				UpdateGameName(userID, channelID, cmd1, cmd2);
				break;
			case 'updatenickname':
				UpdateNickname(userID, channelID, cmd1, cmd2);
				break;
			case 'viewusers':
				ViewAllUsers(userID, channelID);
				break;
			case 'viewwins':
				ViewAllWins(userID, channelID, cmd1);
				break;
			case 'adduser':
				AddUser(userID, channelID, cmd1);
				break;
			case 'addadmin':
				AddAdmin(userID, channelID, cmd1);
				break;
			case 'deleteadmin':
				DeleteAdmin(userID, channelID, cmd1);
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
	var gameID;
	
	db.serialize(function() {
		let sql = `SELECT gameID, gameName FROM Games WHERE gameNickname = ? COLLATE NOCASE`;
		db.get(sql, [game], function(err, row) { 				//First check to make sure the game exists and grab its full name.
			if(err) {
				return console.error(err.message);
			}
			if (row == null) {
				let message = "Invalid nickname. Type !viewgames for a list of valid nicknames.";
				return SendMessageToServer(message, channelID);
			}
			gameName = row.gameName;
			gameID = row.gameID;
			
			sql = `SELECT userID, wins FROM WinTable WHERE gameID = ? ORDER BY wins DESC`
				db.all(sql,[gameID],
				function(error, rows) {
					if (error) {
						console.error(error.message);
					}
					var messageToSend = `__**Top ${gameName} winners:**__\n`;
					var i = 1;
					var numToPrint = rows.length < 6 ? rows.length + 1 : 6; //print the top 5 scores; if less than 5 users print the same number as the number users
					
					rows.forEach(row => {
						if (i < numToPrint) {
							messageToSend = `${messageToSend}${i}: <@!${row.userID}> - ${row.wins}\n`;
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
		db.all("SELECT userID id, totalWins wins FROM Users ORDER BY totalWins DESC",
			(error, rows) => {
				if (error) {
					console.error(error.message);
				}
				var messageToSend = "__**Top winners across all games:**__\n";
				var i = 1;
				var numToPrint = rows.length < 6 ? rows.length + 1 : 6; //print the top 5 scores; if less than 5 users print the same number as the number users
				
				rows.forEach(row => {
					if (i < numToPrint) {
					messageToSend = `${messageToSend}${i}: <@!${row.id}> - ${row.wins}\n`;
						i++;
					}
				});
				
				SendMessageToServer(messageToSend, channelID);	
		});
	});
}

//Decrements the user's specified game wins by 1 then sets their total wins to the sum of all their game wins.
function AddWin(userID, channelID, gameNickname)
{
	if (gameNickname == null) {
		let message = "The nickname for the game must be specfied. Type !viewgames to see a list of games and their nicknames. Format: !win {nickname}";
		SendMessageToServer(message, channelID);
		return;
	}
	
	db.serialize(function() {
		var totalWins;
		var gameWins;
		var gameName;
		var gameID;
		
		let sql = `SELECT gameID, gameName FROM Games WHERE gameNickname = ? COLLATE NOCASE`; //Get the gameID and gameName
		db.get(sql, [gameNickname], function(err, row) {
			if (err) { return console.error(err.message); }
			if (row == null) {
				let message = `The nickname **${gameNickname}** does not exist. Type !viewgames for a list of valid nicknames.**`;
				return SendMessageToServer(message, channelID);
			}
			gameID = row.gameID;
			gameName = row.gameName;
			
			sql = `SELECT wins FROM WinTable WHERE userID = ? AND gameID = ?`; //Get the current number of wins for the user i
			db.get(sql, [userID, gameID], function(err, row) {
				if (err) { return console.error(err.message); }
				if (row == null) {
					let message = `<@!${userID}> is not in my system! Type !addme so you can start tracking your wins.`
					return SendMessageToServer(message, channelID);
				}
				gameWins = row.wins;
				gameWins = gameWins + 1;	//increment game win count
				
				sql = `UPDATE WinTable SET wins = ? WHERE userID = ? AND gameID = ?`; //set the game win count to the new value
				db.run(sql, [gameWins, userID, gameID], function(err) {
					if (err) { return console.error(err.message); }
					
					sql = `SELECT SUM(wins) totalWins FROM WinTable WHERE userID = ?`; //sum all the wins of the user
					db.get(sql, [userID], function(err, row) {
						if (err) { return console.error(err.message); }
						
						totalWins = row.totalWins; 
						
						sql = `UPDATE Users SET totalWins = ? Where userID = ?`; //set the total wins to the sum
						db.run(sql, [totalWins, userID], function(err) {
							if (err) { return console.error(err.message); }
							let message = `Congratulations <@!${userID}> You now have **${gameWins}** wins in **${gameName}** and your total wins are now **${totalWins}**.`;
							SendMessageToServer(message, channelID);
						});
					});
				});
			});
		});	
	});
}

//Decrements the user's specified game wins by 1 then sets their total wins to the sum of all their game wins.
function AddLoss(userID, channelID, gameNickname)
{
	if (gameNickname == null) {
		let message = "The nickname for the game must be specfied. Type !viewgames to see a list of games and their nicknames. Format: !loss {nickname}";
		SendMessageToServer(message, channelID);
		return;
	}
	
	db.serialize(function() {
		var totalWins;
		var gameWins;
		var gameName;
		var gameID;
		
		let sql = `SELECT gameID, gameName FROM Games WHERE gameNickname = ? COLLATE NOCASE`; //Get the gameID and gameName
		db.get(sql, [gameNickname], function(err, row) {
			if (err) { return console.error(err.message); }
			if (row == null) {
				let message = `The nickname **${gameNickname}** does not exist. Type !viewgames for a list of valid nicknames.**`;
				return SendMessageToServer(message, channelID);
			}
			gameID = row.gameID;
			gameName = row.gameName;
			
			sql = `SELECT wins FROM WinTable WHERE userID = ? AND gameID = ?`; //Get the current number of wins for the user i
			db.get(sql, [userID, gameID], function(err, row) {
				if (err) { return console.error(err.message); }
				if (row == null) {
					let message = `<@!${userID}> is not in my system! Type !addme so you can start tracking your wins.`
					return SendMessageToServer(message, channelID);
				}
				gameWins = row.wins;
				gameWins = gameWins - 1;	//decrement game win count
				
				if (gameWins < 0) {
					let message = `<@!${userID}> cannot have less than 0 wins in **${gameName}**.`;
					return SendMessageToServer(message, channelID);
				}
				
				sql = `UPDATE WinTable SET wins = ? WHERE userID = ? AND gameID = ?`; //set the game win count to the new value
				db.run(sql, [gameWins, userID, gameID], function(err) {
					if (err) { return console.error(err.message); }
					
					sql = `SELECT SUM(wins) totalWins FROM WinTable WHERE userID = ?`; //sum all the wins of the user
					db.get(sql, [userID], function(err, row) {
						if (err) { return console.error(err.message); }
						
						totalWins = row.totalWins; 
						
						sql = `UPDATE Users SET totalWins = ? Where userID = ?`; //set the total wins to the sum
						db.run(sql, [totalWins, userID], function(err) {
							if (err) { return console.error(err.message); }
							let message = `<@!${userID}> now has **${gameWins}** wins in **${gameName}** and their total wins have been reduced to **${totalWins}**.`;
							SendMessageToServer(message, channelID);
						});
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
		var nick = bot.servers[bot.channels[channelID].guild_id].members[userID].nick
		var gameIDs = [];
	
		let sql = `INSERT INTO Users(userID, userName, userDiscriminator, userNickname) VALUES(?, ?, ?, ?)`;
		db.run(sql, [userID, user, userDiscriminator, nick], function(err) {
			if(err)
			{
				if(err.message.includes("SQLITE_CONSTRAINT"))
				{
					let message = `<@!${userID}> already exist in my system!`;
					SendMessageToServer(message, channelID);
				}
				return console.error(err.message);
			}
			
			sql = `SELECT gameID from Games`;
			 db.all(sql, [], function(err, rows) {
				if (err) {
					return console.error(err.message);
				}	
				rows.forEach(function(row) {
					gameIDs.push(row.gameID);
				});	
				
				gameIDs.forEach( function(gameID) {			
					sql = `INSERT INTO WinTable(userID, gameID) VALUES(?, ?)`;
					db.run(sql, [userID, gameID], function(err) {
						if (err) {
							console.error(err.message);
							let message = 'ERROR: Could not add user to the win table.';
							SendMessageToServer(message, channelID);
						}						
					});
				});
				let message = `<@!${userID}> is now ready to start tracking their wins!`;
				SendMessageToServer(message, channelID);
			});	
		});	 									
	});
}

//Allows the player to remove themeselves from the database
function RemoveMe(userID, channelID)
{
	let sql = `SELECT userName FROM Users WHERE userID = ?`;	//first checks to make sure the user is in the system
	db.get(sql, [userID], function(err,row) {
		if (row == null) {
			let message = `<@!${userID}> must first type !addme before they can delete themself!`
			return SendMessageToServer(message, channelID);
		}
		if (err) {
			return console.error(err.message);
		}
		
		sql = 'DELETE FROM Users WHERE userID = ?';	//Deletes the user from the Users table
		db.run(sql, [userID], function(err) {
			if (err) {
				return console.error(err.message);
			}
		});
		
		sql = 'DELETE FROM WinTable WHERE userID = ?';	//Deletes all the User's records in the win table
		db.run(sql, [userID], function(err) {
			if (err) {
				console.error(err.message);
			}
		});
		
		let message = `<@!${userID}> has been deleted from the database.`
						+ `\nSorry to see you go... ;_;`;
			SendMessageToServer(message, channelID);
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
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!addme** - adds you to the database so you can start tracking your wins!'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!leaderboard** - prints the top 5 users across all games'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!leaderboard {nickname}** - prints the top 5 users for the specified game'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!win {nickname}** - adds a win to your account for the specified game'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!loss {nickname}** - removes a win from your account for the specified game'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!myscore** - view your total wins'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!myscore {nickname}** - view your total wins for the specified game'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!viewgames** - view list of all games and their nicknames'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!namechange** - enter this command if you\'ve changed your Discord username after adding yourself to my system'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!source** - view my source code'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!admin** - view admin commands'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t**!help** - prints the help screen';
	SendMessageToServer(message, channelID);
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
	var gameName;
	var gameID;
	
	let sql = `SELECT gameID, gameName FROM Games WHERE gameNickname = ? COLLATE NOCASE`;	//Check if the game exists, if so grab its full name
	db.get(sql, [game], function(err, row) {
		console.log(row);
		if (row == null) {
			let message = `**${game}** is an invalid nickname. Type !viewgames for a list of valid nicknames.`;
			return SendMessageToServer(message, channelID);
		}
		if (err) {
			return console.error(err.message);
		}
		gameName = row.gameName;
		gameID = row.gameID;
		
	    sql = `SELECT wins FROM WinTable WHERE userID = ? AND gameID = ?`;
		db.get(sql, [userID, gameID], function(err, row) {
			let message = `<@!${userID}> has **${row.wins}** wins for **${gameName}**.`;
			SendMessageToServer(message, channelID);
		});
	});	
}

//Allows the user to view personal total wins score.
function ViewMyTotalScore(userID, channelID)
{
	let sql = "SELECT totalWins wins FROM Users WHERE userID = ?";
	db.get(sql, [userID], function(err, row) {
		if(err)	{
			return console.error(err.message);
		}
		let message = `Total wins for <@!${userID}> is: **${row.wins}**`;
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
		var newNickName = bot.servers[bot.channels[channelID].guild_id].members[userID].nick
		
		let sql = "SELECT userName name, userDiscriminator discriminator, userNickname FROM Users WHERE userID = ?";
		
		db.get(sql, [userID], function(err, row) {
			if(err) {
				return console.error(err.message);
			}

			if(row == null) {	//if row does not exist, prompt user to add themeselves into the database
				let message = "I don't recognize you <@!${userID}>! Type !addme to be added to my database.";
				return SendMessageToServer(message, channelID);
			}
			var prevName = row.name;
			var prevDiscriminator = row.discriminator;
			var prevNickname = row.userNickname
			
			if(prevName === newName && prevDiscriminator === newDiscriminator && prevNickname == newNickName) {		//if name has not changed: return. No need to update.
				let message = "You are up to date in my system. No change needed!";
				SendMessageToServer(message, channelID);
				return;
			}
			
			sql = "UPDATE Users SET userName = ?, userDiscriminator = ?, userNickname = ? WHERE userID = ?";
			db.run(sql, [newName, newDiscriminator, newNickName, userID], function(err) {
				if(err) {
					return console.error(err.message);
				}
				let message = `Name successfully changed from **${prevName}#${prevDiscriminator}** to **${newName}#${newDiscriminator}**`;
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
	let sql = 'SELECT gameName name, gameNickname nick FROM Games ORDER BY gameName ASC';
	
	db.all(sql, [], function(err, rows) {
		if (err) {
			return console.error(err.message);
		}
		
		if (rows == null) {
			let message = "No games to view. Admin must add a board game using the !addgame command."
			SendMessageToServer(message, channelID);
		}
		
		let message = "__**Game Name: Nickname**__\n";
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
				+ '\n\t\t\t\t\t\t\t\t\t**!addgame {New_Game_Name} {nickname}** - adds a game to the game list and begins tracking wins for all users'
				+ '\n\t\t\t\t\t\t\t\t\t**!deletegame {nickname}** - deletes an existing game from the list and its recorded wins'
				+ '\n\t\t\t\t\t\t\t\t\t**!updategamename {nickname} {New_Game_Name}** - updates the name of an existing game'
				+ '\n\t\t\t\t\t\t\t\t\t**!updatenickname {oldnickname} {newnickname}** - updates the nickname of an existing game'
				+ '\n\t\t\t\t\t\t\t\t\t**!givewin {@userMention}{nickname}** - add a win from the selected user'
				+ '\n\t\t\t\t\t\t\t\t\t**!giveloss {@userMention} {nickname}** - remove a win from the selected user'
				+ '\n\t\t\t\t\t\t\t\t\t**!adduser {@userMention}** - adds the specified user to the database'
				+ '\n\t\t\t\t\t\t\t\t\t**!deleteuser {@userMention}** - delete the specified user from the database'
				+ '\n\t\t\t\t\t\t\t\t\t**!deleteallusers** - DELETES ALL USERS FROM THE DATABASE. BIG NO NO'
				+ '\n\t\t\t\t\t\t\t\t\t**!viewusers** - displays all recorded users in my system'
				+ '\n\t\t\t\t\t\t\t\t\t**!viewwins** - displays all recorded users total wins'
				+ '\n\t\t\t\t\t\t\t\t\t**!viewwins {nickname}** - displays all recorded users wins for the specified game';
	SendMessageToServer(message, channelID);
}


/* HEAD ADMIN PRIVILEGES BELOW THIS POINT */

//Head Admin only. Delete another user from the system
function DeleteUser(userID, channelID, userToDelete)
{
	var userToDeleteID;
	
	if (userID != auth.headAdminID) { //check if user is admin
		let message = `<@!${userID}> is not the head admin!`;
		return SendMessageToServer(message, channelID);
	}
	
	if (userToDelete == null) {
		let message = 'Missing user to delete. Format: !deleteuser {username#1234}';
		return SendMessageToServer(message, channelID);
	}
	
	if(!CheckMentionFormat(userToDelete)) {
		let message = 'Incorect user format. Format: !deleteuser {@userMention}';
		return SendMessageToServer(message, channelID);
	}
	
	userToDeleteID = GetIDFromMention(userToDelete);
	
	RemoveMe(userToDeleteID, channelID);
}

//Head Admin Only. Removes a user to the admin list.
function DeleteAdmin(userID, channelID, adminToDelete)
{
	
	var admin;
	var adminList;
	var adminToDeleteID;
	if (userID != auth.headAdminID) {
		let message = `<@!${userID}> is not the head admin!`
		return SendMessageToServer(message, channelID);
	}
	adminList = auth.adminIDs;
	if(!CheckMentionFormat(adminToDelete)) {
		let message = 'Incorrect user format. Format: **!addadmin {@userMention}**';
		return SendMessageToServer(message, channelID);
	}
	adminToDeleteID = GetIDFromMention(adminToDelete);
	
	if (GetUserByID(adminToDeleteID) == null) {
		let message = `${adminToDelete} is not a user in this server.`
		return SendMessageToServer(message, channelID);
	}
	
		fs.readFile('./auth.json', 'utf8', (err, jsonString) => {
			if (err) { return console.error(err.message); }
			
			let authJsonObj = JSON.parse(jsonString);
			if (!authJsonObj.adminIDs.includes(adminToDeleteID)) {
				let message = `<@!${adminToDeleteID}> is already not an admin!`;
				return SendMessageToServer(message, channelID);
			}
			
			let indexOfAdminToDelete = authJsonObj.adminIDs.indexOf(adminToDeleteID);
			if (indexOfAdminToDelete > -1) {
				authJsonObj.adminIDs.splice(indexOfAdminToDelete, 1);
			}
			
			fs.writeFile('./auth.json', JSON.stringify(authJsonObj, null, 2), (err) => {	//delete the id from the file so that future runs will have the proper data
				if (err) { 
					console.error(err.message);
					let message = 'ERROR: Could not delete admin from file.'
					return SendMessageToServer(message, channelID);		
				}
				
				//let authIDIndex = auth.adminIDs.indexOf(adminToDelete);
				//console.log('index', authIDIndex);
				auth.adminIDs = authJsonObj.adminIDs;
				let message = `<@!${adminToDeleteID}> has been successfully removed as an admin!`;
				SendMessageToServer(message, channelID);		
			});
		});
	
}

//Head Admin Only. Adds a user to the admin list.
function AddAdmin(userID, channelID, newAdmin)
{
	
	var admin;
	var adminList;
	var adminToAddID;
	if (userID != auth.headAdminID) {
		let message = `<@!${userID}> is not the head admin!`
		return SendMessageToServer(message, channelID);
	}
	adminList = auth.adminIDs;
	if(!CheckMentionFormat(newAdmin)) {
		let message = 'Incorrect user format. Format: **!addadmin {@userMention}**';
		return SendMessageToServer(message, channelID);
	}
	adminToAddID = GetIDFromMention(newAdmin);
	
	if (GetUserByID(adminToAddID) == null) {
		let message = `${newAdmin} is not a user in this server.`
		return SendMessageToServer(message, channelID);
	}
	
		fs.readFile('./auth.json', 'utf8', (err, jsonString) => {
			if (err) { return console.error(err.message); }
			
			let authJsonObj = JSON.parse(jsonString);
			if (authJsonObj.adminIDs.includes(adminToAddID)) {
				let message = `<@!${adminToAddID}> is already an admin!`;
				return SendMessageToServer(message, channelID);
			}
			
			authJsonObj.adminIDs.push(adminToAddID);
			
			fs.writeFile('./auth.json', JSON.stringify(authJsonObj, null, 2), (err) => {	//add new id to file so that future runs will have the data
				if (err) { 
					console.error(err.message);
					let message = 'ERROR: Could not write admin to file.'
					return SendMessageToServer(message, channelID);		
				}
				auth.adminIDs = authJsonObj.adminIDs;			//set the currently running data so that admin privilges take into effect immidiately.
				let message = `<@!${userID}> has successfully been added as an admin!`;
				SendMessageToServer(message, channelID);
			});
		});
	
}

//Head Admin only. Deletes the entered games from the game list and all wins tracked for that game
function DeleteGame(userID, channelID, gameNickname)
{
	var gameID;
	var gameName;
	
	if (userID != auth.headAdminID) {
		let message = `<@!${userID}> is not the head admin!`
		return SendMessageToServer(message, channelID);
	}
	
	db.serialize( function() {
		let sql = 'SELECT gameID, gameName FROM Games Where gameNickname = ? COLLATE NOCASE'
		db.get(sql, [gameNickname], function(err, row) {
			if (err) {
				return console.error(err.message);
			}
			if (row == null) {
				let message = `Game with nickname **${gameNickname}** does not exist in my system`;
				return SendMessageToServer(message, channelID);
			}	
			gameName = row.gameName;
			gameID = row.gameID;
			sql = 'DELETE FROM Games Where gameID = ?'
			db.run(sql, [gameID], function(err) {
				if (err) {
					return console.error(err.message);
				}
				sql = 'DELETE FROM WinTable Where gameID = ?'
				db.run(sql, [gameID], function(err) {
					if (err) {
						return console.error(err.message);
					}
					let message = `**${gameName}** has been deleted from the database along with its recorded wins.`;
					SendMessageToServer(message, channelID);
				});
			});
		});
	});
}

//Head Admin only. WIPES ENTIRE USER DATABASE
function DeleteUsers(userID, channelID)
{
	if (userID != auth.headAdminID) {
		let message = `<@!${userID}> is not the head admin!`
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


/* ADMIN PRIVILEGES BELOW THIS POINT */

//Admin only. Adds a player win to the specified user and game.
function GiveUserWin(userID, channelID, userToEdit, game)
{
	var userToEditID;
	
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
		return SendMessageToServer(message, channelID);
	}
	
	if (userToEdit == null) {
		let message = 'Missing the user to edit. Format: !givewin {@userMention} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	if (game == null) {
		let message = 'Missing game. Format: !givewin {@userMention} {nickname}';
		return SendMessageToServer(message, channelID);
	}

	if (!CheckMentionFormat(userToEdit)) {
		let message = 'Incorrect user format. Format: !givewin {@userMention} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	userToEditID = GetIDFromMention(userToEdit);
	
	if (GetUserByID(userToEditID) == null) {
		let message = `${userToEdit} is not in this server. Format: !givewin {@userMention} {nickname}`;
		return SendMessageToServer(message, channelID);
	}	

		AddWin(userToEditID, channelID, game); //Call the AddWin function with user's id
}

//Admin only. Add Game to the Games table, add the new game to the User table as a column.
function AddGame(userID, channelID, gameName, nickName)
{
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
		return SendMessageToServer(message, channelID);
	}
	
	if (gameName == null) {
		let message = "Game name not specified. Command must be !addgame {gameName} {nickname}. Use \'_\' instead of spaces for the game name.";
		SendMessageToServer(message, channelID);
		return;
	}
	
	if (gameName.length > MAX_GAME_NAME_LENGTH) {
		let message = `The game name cannot be larger than ${MAX_GAME_NAME_LENGTH} characters. Please shorten the game name.`;
		SendMessageToServer(message, channelID);
		return;
	}
	
	if (nickName == null) {
		let message = "Nickname not specified.  Command must be !addgame {gameName} {nickname}.";
		SendMessageToServer(message, channelID);
		return;
	}
	
	if (nickName.length > MAX_NICKNAME_LENGTH) {
	let message = `The nickname cannot be larger than ${MAX_NICKNAME_LENGTH} characters. Please shorten the nickname.`;
		SendMessageToServer(message, channelID);
		return;
	}
	
	var formattedGameName = gameName.replace(/_/g, ' ');
		
	db.serialize(function() {
		
		var userIDs = [];
		var idString;
		var gameID;
		
		let sql = `INSERT INTO Games(gameName, gameNickname) VALUES(?, ?)`;//insert game into games table if it does not already exist
		db.run(sql, [formattedGameName, nickName], function(err) {
			if (err) {
				if(err.message.includes("SQLITE_CONSTRAINT"))
				{
					let message = "This game name or nickname already exists in my system!";
					SendMessageToServer(message, channelID);
				}
				return console.error(err.message);
			}
			sql = `SELECT userID from Users`;	//get all existing user IDs
			db.all(sql, [], function(err, rows) {
				if (err) {
					return console.error(err.message);
				}	
				rows.forEach(function(row) {
					userIDs.push(row.userID);
				});	
				
				sql = `SELECT gameID FROM Games WHERE gameNickname = ? COLLATE NOCASE`; //get the game id for the game that was just added
				db.get(sql, [nickName], function(err, row) {
					if (err) {
						return console.error(err.message);
					}
					gameID = row.gameID;
					
					userIDs.forEach(function(playerID) {	//if there are users give them their own rows in the Win Table
						sql = `INSERT INTO WinTable(userID, gameID) VALUES(?, ?)`;
						db.run(sql, [playerID, gameID], function(err) {
							if (err) {
								return console.error(err.message);					
							}								
						});	
					});
				let message = `**${formattedGameName}** with nickname **${nickName}** has been added to the game list and is ready to start tracking wins!`;
				SendMessageToServer(message, channelID);	
				});
			});
		});			
	});
}

//Admin only. Subtracts a player win from the specified user and game.
function GiveUserLoss(userID, channelID, userToEdit, game)
{
	var userToEditID;
	
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
		return SendMessageToServer(message, channelID);
	}
	
	if (userToEdit == null) {
		let message = 'Missing the user to edit. Format: !giveloss {@userMention} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	if (game == null) {
		let message = 'Missing game. Format: !giveloss {@userMention} {nickname}';
		return SendMessageToServer(message, channelID);
	}

	if (!CheckMentionFormat(userToEdit)) {
		let message = 'Incorrect user format. Format: !giveloss {@userMention} {nickname}';
		return SendMessageToServer(message, channelID);
	}
	
	userToEditID = GetIDFromMention(userToEdit);
	
	if (GetUserByID(userToEditID) == null) {
		let message = `${userToEdit} is not in this server. Format: !giveloss {@userMention} {nickname}`;
		return SendMessageToServer(message, channelID);
	}	

		AddLoss(userToEditID, channelID, game); //Call the AddLoss function with user's id
}

//Admin only. Adds the specified user to the database.
function AddUser(userID, channelID, userToAdd)
{
	var userToAddID;
	var userToAddObject;
	
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
		return SendMessageToServer(message, channelID);
	}
	
	if (!CheckMentionFormat(userToAdd)) {
		let message = 'Incorrect user format. Format: !adduser {@userMention}';
		return SendMessageToServer(message, channelID);
	}
	
	userToAddID = GetIDFromMention(userToAdd);
	userToAddObject = GetUserByID(userToAddID);
	
	if (userToAddObject == null) {
		let message = `${userToAdd} does not exist. Format: !adduser {@userMention}`;
		return SendMessageToServer(message, channelID);
	}
	
	AddMe(userToAddObject.username, userToAddID, channelID);
}

//Admin only. Update the gameName of an existing game in the database
function UpdateGameName(userID, channelID, nickName, newGameName)
{
	var oldGameName;
	
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
		return SendMessageToServer(message, channelID);
	}
	
	if (nickName == null) {
		let message = `Nickname for the game is missing. Format: !updategamename {nickname} {New_Game_Name}`;
		return SendMessageToServer(message, channelID);
	}
	
	if (newGameName == null) {
		let message = `The new name for the game is missing. Format: !updategamename {nickname} {New_Game_Name}`;
		return SendMessageToServer(message, channelID);
	}

	if (nickName.length > MAX_NICKNAME_LENGTH) {
		let message = `The length of the nickname cannot be larger than ${MAX_NICKNAME_LENGTH} characters. Format: !updategamename {nickname} {New_Game_Name}`;
		return SendMessageToServer(message, channelID);
	}
	
	if (newGameName.length > MAX_GAME_NAME_LENGTH) {
		let message = `The length of the game name cannot be larger than ${MAX_GAME_NAME_LENGTH} characters. Format: !updategamename {nickname} {New_Game_Name}`;
		return SendMessageToServer(message, channelID);
	}
	
	newGameName = newGameName.replace(/_/g, ' ');
	
	let sql = 'SELECT gameName FROM Games Where gameNickname = ? COLLATE NOCASE';
	db.get(sql, [nickName], function(err, row) {
		if (row == null) {
			let message = `**${nickName}** does not exist in my system. Type !viewgames for a list of valid nicknames.`;
			return SendMessageToServer(message, channelID);
		}
		oldGameName = row.gameName;
		
		sql = 'UPDATE Games SET gameName = ? WHERE gameNickname = ?'
		db.run(sql, [newGameName, nickName], function(err) {
			if (err) {
				return console.error(err.message);
			}
			let message = `'**${oldGameName}**' successfully changed to '**${newGameName}**'`;
			SendMessageToServer(message, channelID);
		});
	});
}

//Admin only. Updates the nickname of an existing game
function UpdateNickname(userID, channelID, oldNickName, newNickName)
{
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
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
	
	let sql = 'UPDATE Games SET gameNickname = ? WHERE gameNickname = ? COLLATE NOCASE';
	db.run(sql,[newNickName, oldNickName], function(err) {
		if (err) {
			return console.error(err.message);
		}
			sql = 'SELECT gameName FROM Games WHERE gameNickname = ? COLLATE NOCASE';
			db.get(sql, [newNickName], function(err, row) {
				if (row == null) {
					let message = "Error: Could not validate nickname has changed.";
					SendMessageToServer(message, channelID);
				}
				let message = `The nickname for **${row.gameName}** has changed from **${oldNickName}** to **${newNickName}**.`
				SendMessageToServer(message, channelID);
			});
	});
}

//Admin only. Prints all users in the system
function ViewAllUsers(userID, channelID)
{
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
		return SendMessageToServer(message, channelID);
	}
	
	let sql = `SELECT userID FROM Users`;
	db.all(sql, [], function(err, rows) {
		if (err) {
			return console.error(err.message);
		}
		let message = `**__Displaying all registered users:__**\n`;
		rows.forEach(function(row) {
			message = `${message}<@!${row.userID}>\n`;
		});
		SendMessageToServer(message, channelID);
	});	
}

//Admin only. Decides which view all function to use based on user input
function ViewAllWins(userID, channelID, gameNickname)
{
	if (!auth.adminIDs.includes(userID)  && userID != auth.headAdminID) {
		let message = `<@!${userID}> can\'t tell me what to do!`;
		return SendMessageToServer(message, channelID);
	}
	
	if (gameNickname == null) {
		ViewAllTotalWins(channelID);
	}
	else {
		ViewAllWinsByGame(channelID, gameNickname);
	}
}

//Admin only. Displays the total wins for each user.
function ViewAllTotalWins(channelID)
{
	let sql = `SELECT userID, totalWins from Users`;
	db.all(sql, [], function(err, rows) {
		if (err) {
			return console.error(err.message);
		}
		let message = `**__Displaying all users' total wins:__**\n`;
		rows.forEach(function(row) {
			message = `${message}<@!${row.userID}>: ${row.totalWins}\n`;
		});
		SendMessageToServer(message, channelID);
	});
}

//Admin only. Displays the wins in the specified game for each user.
function ViewAllWinsByGame(channelID, gameNickname) 
{	
	db.serialize(function() {
		var gameName;
		var gameID;
		
		let sql = `SELECT gameID, gameName FROM Games WHERE gameNickname = ? COLLATE NOCASE`;
		db.get(sql, [gameNickname], function(err, row) {
			if (err) {
				return console.error(err.message);
			}
			if (row == null) {
				let message = `**${gameNickname}** is not a valid nickname. Type **!viewgames** for a list of valid nicknames.`;
				return SendMessageToServer(message, channelID);
			}
			gameName = row.gameName;
			gameID = row.gameID;
			
				sql = `SELECT userID, wins FROM WinTable WHERE gameID = ?`;
				db.all(sql, [gameID], function(err, rows) {
				if (err) {
					return console.error(err.message);
				}
				let message = `**__Displaying all user wins for the game ${gameName}:__**\n`;
				rows.forEach(function(row) {
					message = `${message}<@!${row.userID}>: ${row.wins}\n`;
				});
				SendMessageToServer(message, channelID);
			});
		});
	});
}

/* CRUD FUNCTIONS */

//Returns the gameID corresponding to given nickname
function GetGameIdByNickname(nickname)
{
	var ID;
	
	let sql = `SELECT gameID FROM Games WHERE gameNickname = ? COLLATE NOCASE`;
	db.get(sql, [nickname], function(err, row) {
		if (err) {
			return console.error(err.message);
		}
		ID = row.gameID;
	});
	return ID;
}

//Returns a list of all userIDs
function GetAllUserIDs ()
{
	var IDs;
	let sql = `SELECT userID FROM Users`
		db.all(sql, [], function(err, rows) {
			if (err) {
				return console.error(err.message);
			}
			rows.forEach(function(row) {				
				IDs = rows;
			});
		});
	return IDs;
}

//Returns a list of all existing gameIDs
function GetAllGameIDs()
{
	var IDs = [];
	let sql = `SELECT gameID from Games`;
		 db.all(sql, [], function(err, rows) {
			if (err) {
				return console.error(err.message);
			}	
			rows.forEach(function(row) {
				IDs.push(row.gameID);
			});	
			
			return IDs;
		});			
}

//Retrieves the full user object from any user in the channel
function GetUserByID(userID)
{
	var user = bot.users[userID];
	return user;
}

//Verifies a user mention is in the correct format
function CheckMentionFormat(mention) 
{
	if (mention.substring(0,2) != '<@' || mention.charAt(mention.length - 1) != '>') {
		return false;
	}
	else {
		return true;
	}
}

//Gets the user id from a mention
function GetIDFromMention(userMention)
{
	var id;
	userMention = userMention.replace('!', ''); //check if they are using a nickame
    id = userMention.substring(2, userMention.length - 1);
	return id;
}