const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
	version: '1.8.9',
	username: 'bot',
	host: 'localhost',
	port: 61464
});

let active = false;

async function lookAround() {
	active = true;
	console.log('lookAround');

	const pitch = bot.entity.pitch;
	const yaw = bot.entity.yaw;

	await bot.look(yaw - Math.PI * 0.3, pitch + Math.PI * 0.2);
	await bot.waitForTicks(2);
	await bot.look(yaw - Math.PI * 1.2, Math.PI * 0.5);
	await bot.waitForTicks(2);
	await bot.look(yaw, pitch);
	active = false;
}

async function moveAround() {
	active = true;
	console.log('moveAround');

	bot.setControlState('sneak', true);
	await bot.waitForTicks(2);
	bot.setControlState('sneak', false);
	await bot.waitForTicks(2);
	bot.setControlState('sneak', true);
	await bot.waitForTicks(2);
	bot.setControlState('sneak', false);
	await bot.waitForTicks(1);
	bot.setControlState('left', true);
	await bot.waitForTicks(2);
	bot.setControlState('left', false);
	await bot.waitForTicks(2);
	bot.setControlState('right', true);
	await bot.waitForTicks(4);
	bot.setControlState('right', false);
	await bot.waitForTicks(2);
	bot.setControlState('left', true);
	await bot.waitForTicks(2);
	bot.setControlState('left', false);
	await bot.waitForTicks(10);
	bot.setControlState('jump', true);
	await bot.waitForTicks(2);
	bot.setControlState('jump', false);
	bot.swingArm('right');
	active = false;
}

bot.on('messagestr', async message => {
	if (message.includes('look')) {
		lookAround();
	}
	if (message.includes('natural')) {
		
	}

	if (message.includes('pitch')) {
		console.log(bot.players['TimelessBot2'].entity.pitch, bot.players['TimelessBot2'].entity.yaw);
	}
});

const last = {};

bot.on('move', () => {
	if (last.position && !active) {
		if (bot.entity.position.distanceTo(last.position) > 0.1) {
			moveAround();
		} else if (bot.entity.pitch !== last.pitch || bot.entity.yaw !== last.yaw) {
			lookAround();
		}
	}

	last.pitch = bot.entity.pitch;
	last.yaw = bot.entity.yaw;
	last.position = bot.entity.position;
});