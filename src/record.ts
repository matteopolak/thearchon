import fs from 'fs/promises';
import path from 'path';

import type { PacketMeta } from 'minecraft-protocol';
import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';

import type { RecordingStep } from './typings';

const outputDirectory = path.join(__dirname, '..', 'recordings');

const FROM_NOTCH_BYTE = 360 / 256;
const PI = Math.PI;
const PI_2 = Math.PI * 2;
const TO_RAD = PI / 180;
const KEY_COMBINATIONS = [
	{ forward: true },
	{ forward: true, left: true },
	{ left: true },
	{ left: true, back: true },
	{ back: true },
	{ back: true, right: true },
	{ right: true },
	{ right: true, forward: true },
];

function euclideanMod(numerator: number, denominator: number): number {
	const result = numerator % denominator;
	return result < 0 ? result + denominator : result;
}

function fromNotchianYaw(yaw: number): number {
	return euclideanMod(PI - toRadians(yaw), PI_2);
}

function toRadians(degrees: number): number {
	return TO_RAD * degrees;
}

function fromNotchianPitch(pitch: number): number {
	return euclideanMod(toRadians(-pitch) + PI, PI_2) - PI;
}

function fromNotchianYawByte(yaw: number) {
	return fromNotchianYaw(yaw * FROM_NOTCH_BYTE);
}

function fromNotchianPitchByte(pitch: number) {
	return fromNotchianPitch(pitch * FROM_NOTCH_BYTE);
}

const port = parseInt(process.argv[2]);

if (isNaN(port)) {
	console.error('Usage: npm run record -- <port>');
	process.exit(1);
}

interface Settings {
	entityId: number;
	record: boolean;
	position: Vec3;
	pitch: number;
	yaw: number;
	data: RecordingStep[];
}

const bot = mineflayer.createBot({
	username: 'Recorder',
	host: 'localhost',
	port,
	version: '1.8.9',
});

const settings: Settings = {
	record: false,
	position: new Vec3(0, 0, 0),
	pitch: 0,
	yaw: 0,
	entityId: 0,
	data: [],
};

async function jump() {
	bot.setControlState('jump', true);
	await bot.waitForTicks(1);
	bot.setControlState('jump', false);
}

async function replay(steps: RecordingStep[]) {
	for (const step of steps) {
		if (step.swing) bot.swingArm(undefined, undefined);
		if (step.jump) jump();

		if (step.sprint === !bot.controlState.sprint) {
			bot.setControlState('sprint', step.sprint);
		}

		if (step.crouch === !bot.controlState.sneak) {
			bot.setControlState('sneak', step.crouch);
		}

		if (step.forward === !bot.controlState.forward) {
			bot.setControlState('forward', step.forward);
			if (step.forward) bot.setControlState('back', !step.forward);
		}

		if (step.back === !bot.controlState.back) {
			if (step.back) bot.setControlState('forward', !step.back);
			bot.setControlState('back', step.back);
		}

		if (step.left === !bot.controlState.left) {
			bot.setControlState('left', step.left);
			if (step.left) bot.setControlState('right', !step.left);
		}

		if (step.right === !bot.controlState.right) {
			if (step.right) bot.setControlState('left', !step.right);
			bot.setControlState('right', step.right);
		}

		if (step.yaw !== undefined || step.pitch !== undefined) {
			bot.entity.pitch = step.pitch ?? bot.entity.pitch;
			bot.entity.yaw += step.yaw ?? 0;
		}

		if (step.wait) {
			await new Promise(resolve => setTimeout(resolve, step.wait));
		}
	}

	bot.clearControlStates();
}

bot.once('spawn', () => {
	bot.chat(
		'Ready! Type "start" to start recording, "stop" to stop, and "play <file>" to play back a recording.',
	);
});

bot.on('chat', async (username, message) => {
	if (message.startsWith('play ')) {
		const name = message.slice(5);

		try {
			const file = JSON.parse(
				await fs.readFile(path.join(outputDirectory, name), 'utf8'),
			);

			bot.chat(`Playing back recording '${name}'...`);

			await replay(file);
			return bot.chat(`Finished playing '${name}'!`);
		} catch {
			return bot.chat(`Could not find file 'recordings/${name}'`);
		}
	}

	if (message === 'start') {
		if (settings.record)
			return bot.chat('Already recording. Use "stop" to stop.');

		const player = bot.players[username];

		if (!player)
			return bot.chat('Out of range. Please move closer and try again.');

		settings.position = player.entity.position.clone();
		settings.pitch = player.entity.pitch;
		settings.yaw = player.entity.yaw;
		settings.entityId = player.entity.id;
		settings.record = true;

		return bot.chat('Starting recording...');
	}

	if (message === 'stop') {
		settings.record = false;
		settings.data.sort((a, b) => a.time! - b.time!);

		const data = [];

		for (const [i, step] of settings.data.entries()) {
			const prev = settings.data[i - 1];

			if (i === 0) {
				step.wait = 0;

				if (step.pitch === undefined) step.pitch = settings.pitch;
			} else {
				step.wait =
					i === settings.data.length - 1
						? 0
						: settings.data[i + 1].time! - step.time!;
			}

			if (
				!prev ||
				step.forward !== prev.forward ||
				step.back !== prev.back ||
				step.left !== prev.left ||
				step.right !== prev.right ||
				step.jump !== prev.jump ||
				step.swing !== prev.swing ||
				step.sprint !== prev.sprint ||
				step.crouch !== prev.crouch
			) {
				data.push(step);
			}
		}

		await fs.mkdir(outputDirectory, { recursive: true });
		await fs.writeFile(
			path.join(outputDirectory, Date.now().toString()),
			JSON.stringify(data),
		);

		return bot.chat(`Saved recording to 'recordings/${Date.now()}'`);
	}
});

function getPressedKeys(packet: {
	dX: number;
	dY: number;
	dZ: number;
	yaw?: number;
	pitch?: number;
	onGround?: boolean;
}) {
	let direction;

	const magnitude = Math.sqrt(packet.dX ** 2 + packet.dZ ** 2);

	if (magnitude > 10) {
		if (packet.dX === 0) {
			direction = packet.dZ < 0 ? 0 : Math.PI;
		} else if (packet.dZ === 0) {
			direction = packet.dX < 0 ? 0.5 * Math.PI : 1.5 * Math.PI;
		} else {
			direction = Math.atan2(-packet.dX, -packet.dZ);

			if (direction < 0) direction += 2 * Math.PI;
		}

		const difference = direction - bot.entities[settings.entityId].yaw;
		let eighth = Math.round(difference / (0.25 * Math.PI));

		if (eighth < 0) eighth += 8;

		if (packet.pitch !== undefined || packet.yaw !== undefined) {
			return {
				...KEY_COMBINATIONS[eighth],
				onGround: packet.onGround,
				yaw:
					packet.yaw !== undefined
						? fromNotchianYawByte(packet.yaw) - settings.yaw
						: undefined,
				pitch:
					packet.pitch !== undefined
						? fromNotchianPitchByte(packet.pitch)
						: undefined,
			};
		}

		return KEY_COMBINATIONS[eighth];
	}

	return {
		forward: false,
		back: false,
		left: false,
		right: false,
		onGround: packet.onGround,
		yaw:
			packet.yaw !== undefined
				? fromNotchianYawByte(packet.yaw) - settings.yaw
				: undefined,
		pitch:
			packet.pitch !== undefined
				? fromNotchianPitchByte(packet.pitch)
				: undefined,
	};
}

function parsePacket(packet: any, metadata: PacketMeta) {
	switch (metadata.name) {
		case 'entity_look':
			return {
				onGround: packet.onGround,
				yaw:
					packet.yaw !== undefined
						? fromNotchianYawByte(packet.yaw) - settings.yaw
						: undefined,
				pitch:
					packet.pitch !== undefined
						? fromNotchianPitchByte(packet.pitch)
						: undefined,
			};
		case 'rel_entity_move':
			return getPressedKeys(packet);
		case 'entity_move_look':
			return getPressedKeys(packet);
		case 'animation':
			if (packet.animation === 0) return { swing: true };
			break;
		case 'entity_metadata':
			const data = packet.metadata[0];
			if (data?.type === 0 && data?.key === 0)
				return { crouch: data.value === 2 };
			break;
		case 'entity_teleport':
			if (!packet.onGround) return { jump: true };
			break;
		case 'update_attributes':
			const property = packet.properties.find(
				(p: { key: string; modifiers: any[] }) =>
					p.key === 'generic.movementSpeed',
			);
			if (property) return { sprint: property.modifiders?.length > 0 };
			break;
	}

	return null;
}

bot._client.on('packet', async (packet, metadata) => {
	if (!settings.record || packet.entityId !== settings.entityId) return;

	const now = Date.now();
	const data: RecordingStep | null = parsePacket(packet, metadata);

	if (data) {
		data.time = now;
		settings.data.push(data);
	}
});
