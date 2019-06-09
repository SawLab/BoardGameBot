var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./BoardGameBot.db', (err) => {
	if (err)
	{
		console.error(err.message);
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
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
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
				AddPlayerWin(user, userID, channelID);
				break;
			case 'deleteall':
				DeleteData(channelID);
				break;
			default:
				IncorrectCommand(channelID);
				break;
         }
     }
});

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

function AddPlayerWin(user, userID, channelID)
{
	db.serialize(function() {
		let sql = 'SELECT numWins wins FROM Users WHERE userID = ?';
		db.get(sql, [userID], (err, row) => {
			if(err) {
				return console.error(err.message);
			}
			
			let totalWins = row.wins;
			totalWins = totalWins + 1; //add 1 to the player's total win count
			
			sql = 'UPDATE Users SET numWins = ? WHERE userID = ?';
		
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

function Ping(channelID)
{
	let message = 'Pong';
	SendMessageToServer(message, channelID);
}

function IncorrectCommand(channelID)
{
	let message = 'Command not recognized. Type !help for a list of approved commands.';
	SendMessageToServer(message, channelID);
}

function Help(channelID)
{
	let message = 'Approved Commands:'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!addme - adds you to the database so you can start tracking your wins!'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!leaderboard - prints the top 5 users'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!win - adds a win to your account'
				+ '\n\t\t\t\t\t\t\t\t\t\t\t!help - prints the help screen';
	SendMessageToServer(message, channelID);
}

function DeleteData(channelID)
{
	let sql = "DELETE FROM Users";
	let message = "All data deleted";
	db.run(sql, [], function(err) {
		if (err) {
			return console.error(err.message);
		}
		SendMessageToServer(message, channelID);
	});
}

function GetUserByID(userID)
{
	var user = bot.users[userID];
	return user;
}

function SendMessageToServer(messageToSend, channelID)
{
	bot.sendMessage({
		to: channelID,
		message: messageToSend
	});
}