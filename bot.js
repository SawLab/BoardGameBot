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
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!'
                });
            break;
			
			case 'score': 	
				db.serialize(function() {
					db.all("SELECT * FROM Users ORDER BY numWins",
						(error, rows) => {
							console.log(rows);
						// receives all the results as an array
						rows.forEach( row => 
						bot.sendMessage({
							to: channelID,
						    message: `${row.userName}: ${row.numWins}`
						}));
					});
				});
				break;
				
			case 'addme':
			db.serialize(function() {
				db.run('INSERT INTO Users(userName, userID) VALUES(?, ?)', [user, userID], function(err) {
					if(err)
					{
						console.error(err.message);
					}
					console.log('A row has been inserted with playerName ' + userName + 'and userID ' + id);
				});
			});
            // Just add any case commands if you want to..
         }
     }
});