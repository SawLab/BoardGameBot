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
		var id = userID;
		var userName = user;
       
        args = args.splice(1);
        switch(cmd) {
            case 'ping':
                Ping(channelID);
				break;			
			case 'leaderboard': 	
				TotalWinsLeaderboard(channelID);
				break;				
			case 'addme':
				AddPlayer(user, userID);
				break;			
			case 'win':
				AddPlayerWin(user, userID, channelID);
				break;
			default:
				
         }
     }
});

function TotalWinsLeaderboard(channelID) {
	db.serialize(function() {
		db.all("SELECT userName user, numWins wins FROM Users ORDER BY numWins DESC",
			(error, rows) => {
				if (error) {
					console.error(error.message);
				}
				var messageToSend = "";
				var i = 1;
				var numToPrint = rows.length < 6 ? rows.length + 1 : 6; //print the top 5 scores; if less than 5 users print the same number as the number users
				
				rows.forEach(row => {
					if (i < numToPrint) {
						messageToSend = messageToSend + i + ": " + row.user + ": " + row.wins + "\n";
						i++;
					}
				});
				
				bot.sendMessage({
					to: channelID,
					message: messageToSend
				});		
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
			console.log('Total wins set to ' + totalWins);
			totalWins = totalWins + 1; //add 1 to the player's total win count
			console.log('Total wins incremented to ' + totalWins);
			
			sql = 'UPDATE Users SET numWins = ? WHERE userID = ?';
		
			db.run(sql, [totalWins, userID], function(err) {
				if (err) {
					return console.error(err.message);
				}
				bot.sendMessage({
					to: channelID,
					message: `Congratulations ${user}! Your total wins are now ${totalWins}.`
				});
			});
		});		
		
		
	});
}

function AddPlayer(user, userID)
{
	db.serialize(function() {
		db.run('INSERT INTO Users(userName, userID) VALUES(?, ?)', [user, userID], function(err) {
			if(err)
			{
				return console.error(err.message);
			}
		});
	});
}

function Ping(channelID)
{
	bot.sendMessage({
		to: channelID,
		message: 'Pong!'
	});
}