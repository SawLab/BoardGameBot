var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var sqlite3 = require('sqlite3').verbose();
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
        var cmd1 = args[0];
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
				TotalWinsLeaderboard(channelID);
				break;				
			case 'addme':
				AddPlayer(user, userID, channelID);
				break;			
			case 'win':
				AddPlayerWin(user, userID, channelID, cmd2);
				break;
			case 'myscore':
				ViewMyScore(userID, channelID);
				break;
			case 'namechange':
				ChangeUserName(userID, channelID);
				break;
			case 'source':
				ViewSourceCode(channelID);
				break;
			case 'deleteusers':
				DeleteUsers(channelID);
				break;
			case 'addgame':
				AddGame(userID, channelID, cmd2, cmd3);
				break;
			case 'viewgames':
				ViewGames(channelID);
				break;
			default:
				IncorrectCommand(channelID);
				break;
         }
     }
});

//Prints the top 5 users. Prints less than 5 if there are less than 5 users.
function TotalWinsLeaderboard(channelID) {
	db.serialize(function() {
		db.all("SELECT userName user, totalWins wins FROM Users ORDER BY totalWins DESC",
			(error, rows) => {
				if (error) {
					console.error(error.message);
				}
				var messageToSend = "";
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

//Increment the designated user's win counter
function AddPlayerWin(user, userID, channelID, gameNickName)
{
	db.serialize(function() {
		let sql = 'SELECT totalWins wins FROM Users WHERE userID = ?';
		db.get(sql, [userID], (err, row) => {
			if(err) {
				return console.error(err.message);
			}
			
			let totalWins = row.wins;
			totalWins = totalWins + 1; //add 1 to the player's total win count
			
			sql = 'UPDATE Users SET totalWins = ? WHERE userID = ?';
		
			db.run(sql, [totalWins, userID], function(err) {
				if (err) {
					return console.error(err.message);
				}
				let message = `Congratulations ${user}! Your total wins are now ${totalWins}.`;
				SendMessageToServer(message, channelID);
			});
		});				
	});
}

//Adds the user to the database. If user already exists, let the user know.
function AddPlayer(user, userID, channelID)
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
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!leaderboard - prints the top 5 users'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!win - adds a win to your account'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!myscore - view your total wins'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!viewgames - view list of all games and their nicknames'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!namechange - enter this command if you\'ve changed your Discord username after adding yourself to my system'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!source - view my source code'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!help - prints the help screen';
	SendMessageToServer(message, channelID);
}

//ONLY FOR TESTING PURPOSES DELETE ONCE COMPLETE
function DeleteUsers(channelID)
{
	let sql = "DELETE FROM Users";
	let message = "User data deleted";
	db.run(sql, [], function(err) {
		if (err) {
			return console.error(err.message);
		}
		SendMessageToServer(message, channelID);
	});
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

//Allows the user to view personal score.
function ViewMyScore(userID, channelID)
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
		let sql = 'INSERT INTO Games(gameName, nickName) VALUES(?, ?)';
		db.run(sql, [name, nickName], function(err) {
			if (err) {
				return console.error(err.message);
			}
			
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