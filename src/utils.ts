import fs from 'fs/promises';
import path from 'path';
import { Worker } from 'worker_threads';

import axios from 'axios';
import chalk from 'chalk';
import type { Client, TextChannel } from 'discord.js';
import { Item } from 'prismarine-item';

import characters from './characters';
import config, { discordConfig } from './config';
import { FIX_OBJECT_REGEX, STAFF_LIST_REGEX, WORKER_PATH } from './constants';
import {
	MessageType,
	MovementInstruction,
	OpenAIResponse,
	SellType,
} from './typings';
import type {
	BaseBotOptions,
	Direction,
	IdData,
	MessagePayload,
	RawItem,
	RawMapData,
	StaffCategory,
	StaffMember,
	WitResponse,
} from './typings';

const CHARACTER_WIDTH = 12;
const CHARACTER_HEIGHT = 14;

// prettier-ignore
const filter: string[][] = [
	['0', '2', '3', '6', '7', '8', '9', 'C', 'D', 'G', 'J', 'L', 'O', 'Q', 'U', 'V', 'W', 'Z'],
	['1', '4', '5', 'A', 'B', 'E', 'F', 'H', 'I', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'X', 'Y'],
	[],
];

axios.defaults.validateStatus = () => true;

export function chance(percent: number): boolean {
	return Math.random() < percent;
}

export function random(max: number, min: number = 0) {
	return Math.floor(Math.random() * (max - min)) + min;
}

export function randomArray<T>(array: T[]): T {
	return array[random(array.length)];
}

export function getItemDisplayName(item: Item, stripColour = true) {
	// @ts-ignore
	const name: string | undefined = item.nbt?.value?.display?.value?.Name?.value;

	if (!name) return item.displayName;

	return stripColour ? name.replace(/§\w/g, '') : name;
}

export async function generateActions(prompt: string) {
	const { data, status } = await axios.get<WitResponse>(
		'https://api.wit.ai/message',
		{
			params: {
				q: prompt,
			},
			headers: {
				Authorization: `Bearer ${config.witai_key}`,
			},
		},
	);

	if (status !== 200) return [];

	const movements =
		data.entities['movement_with_repeat:movement_with_repeat'] ?? [];

	const instructions: MovementInstruction[] = [];

	for (const movement of movements) {
		const [action, count] = movement.entities.reduce(
			(a, b) => {
				if (b.confidence < 0.9 || b.value === 'spin') return a;
				if (b.name === 'wit$number') a[1] = b.value;
				else if (b.name === 'movement_type') a[0] = b.value;

				return a;
			},
			[null, 1] as [Direction | null, number],
		);

		if (action) {
			instructions.push({
				direction: action,
				distance: count,
			});
		}
	}

	return instructions;
}

export async function generateResponse(
	prompt: string,
): Promise<string | undefined> {
	if (config.openai_key === undefined) return undefined;

	const { data: response, status } = await axios.post<OpenAIResponse>(
		'https://api.openai.com/v1/answers',
		{
			model: 'davinci',
			search_model: 'babbage',
			question: prompt,
			documents: [
				"I'm fishing at the docks",
				'I like to fish and watch Netflix',
				'Ftop is a list of the top factions',
				'Factions are groups of players',
				'To become the best faction, you need to have the most value in spawners',
				"I'm currently here and present",
			],
			examples_context:
				"I am fishing on TheArchon, which is a factions server. Cheating is not allowed. I will not tell you how to make money because it's a secret.",
			examples: [
				['Are you cheating?', 'no? why would i cheat'],
				["Say 'hello world'", 'um ok hello world'],
				['Say asjkdhaskjdh', 'asjkdhaskjdh'],
				['How do I make money?', 'idk but fishing is pretty good'],
				['I love you', 'ok + L'],
				['Can you give me some money', 'no get it yourself'],
				["What's 20+40", '60'],
				['What is 3 times 6', '18'],
				['What is 5 times 5', '25'],
				["What's 38*10", '380'],
				["What's 1x1", '1'],
			],
			n: 1,
			temperature: 0.5,
			max_tokens: 15,
		},
		{
			headers: {
				Authorization: `Bearer ${config.openai_key}`,
			},
		},
	);

	if (
		status !== 200 ||
		response.answers === undefined ||
		response.answers.length === 0
	)
		return undefined;

	const answer = response.answers[0];
	const newlineIndex = answer.indexOf('\n');

	return newlineIndex === -1 ? answer : answer.substring(0, newlineIndex);
}

export const currencyFormatter = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 2,
	minimumFractionDigits: 2,
});

function findCharacter(
	json: RawMapData,
	options: { x: number; y: number },
): string | undefined {
	// half of the letters have a pixel here, so it's worthwhile
	// to check for it at the start
	const bit = json.data[options.x + 4 + (options.y + 4) * json.columns];
	const filtered = filter[bit === 119 || bit === 34 ? 1 : 0];

	for (const character of filtered) {
		let match = true;

		const bits: number[] = characters[character as keyof typeof characters];

		for (let i = 0; i < CHARACTER_HEIGHT; i += 2) {
			for (let j = 0; j < CHARACTER_WIDTH; j += 2) {
				const index = options.x + j + (options.y + i) * json.columns;

				if (json.data[index] === 2) {
					options.x += CHARACTER_WIDTH;

					return undefined;
				}

				if (
					!!bits[j + i * CHARACTER_WIDTH] !==
					(json.data[index] === 119 || json.data[index] === 34)
				) {
					match = false;
					break;
				}
			}

			if (!match) break;
		}

		if (match) {
			for (let i = 0; i < CHARACTER_HEIGHT; i++) {
				for (let j = 0; j < CHARACTER_WIDTH; j++) {
					json.data[options.x + j + (options.y + i) * json.columns] = 2;
				}
			}

			options.x += CHARACTER_WIDTH;

			return character;
		}
	}

	return undefined;
}

export function unscramble(json: RawMapData) {
	const rows = json.rows!;
	const columns = json.columns;

	const characters = [];
	const options = {
		x: 0,
		y: 0,
	};

	for (options.y = 0; options.y < rows - CHARACTER_HEIGHT; ++options.y) {
		for (options.x = 0; options.x < columns - CHARACTER_WIDTH; ++options.x) {
			const character = findCharacter(json, options);

			if (character) {
				characters.push(character);
			}
		}
	}

	return characters;
}

export function sleep(ms: number): Promise<true> {
	if (ms <= 0) return Promise.resolve(true);

	return new Promise(r => setTimeout(r, ms, true));
}

export function cooldownSleep(last: number, cooldown: number): Promise<true> {
	const now = Date.now();

	if (now - last < cooldown) {
		return sleep(last - now + cooldown);
	}

	return Promise.resolve(true);
}

export function createPromiseResolvePair(): {
	promise: Promise<void>;
	resolve: () => void;
} {
	let resolve: any;
	const promise: Promise<void> = new Promise(r => (resolve = r));

	return { promise, resolve };
}

export function startNewProcess(
	payload: { options: BaseBotOptions },
	workers: Map<string, Worker>,
	discord: { client: Client; idMap: Map<number, IdData> } | null,
) {
	console.log(
		`         ${' '.repeat(17)}${chalk.bold(
			chalk.cyan('Parent'),
		)} Starting worker for ${chalk.yellow(payload.options.alias)}`,
	);

	const worker = new Worker(WORKER_PATH, {
		workerData: payload,
	});

	workers.set(payload.options.alias, worker);

	const messageHandler = async (packet: MessagePayload) => {
		if (packet.type === MessageType.SELL_TYPE) {
			console.log(
				`         ${' '.repeat(17)}${chalk.bold(
					chalk.cyan('Parent'),
				)} ${chalk.yellow(payload.options.alias)} is ${
					packet.data.is_fishing ? 'fishing' : 'not fishing'
				} and trading for ${
					packet.data.sell_type === SellType.COINS ? 'coins' : 'mob coins'
				}`,
			);

			payload.options.fish = packet.data.is_fishing;
			payload.options.sell_type = packet.data.sell_type;

			return;
		}

		if (packet.type === MessageType.DISCORD_RESPONSE) {
			const entry = discord!.idMap.get(packet.data.id);
			if (!entry) return;

			if (++entry.count >= entry.needed) {
				discord!.idMap.delete(packet.data.id);
			}

			entry.responses.push([payload.options.alias, packet.data.message]);

			const channel = discord!.client.channels.cache.get(
				entry.channel_id,
			) as TextChannel;
			if (!channel) return;

			channel.send(
				entry.responses.map(r => `\`${escape(r[0])}\`: ${r[1]}`).join('\n'),
			);

			return;
		}

		const channel =
			discordConfig.channels.notifications && discord
				? discord.client.channels.cache.get(
						discordConfig.channels.notifications,
				  )
				: undefined;

		if (channel?.type !== 'GUILD_TEXT') return;
		if (packet.type === MessageType.NOTIFICATION) {
			return channel.send(
				`${
					packet.data.tag
						? `${discordConfig.whitelist.map(u => `<@${u}>`).join(' ')}\n`
						: ''
				}**NOTIFICATION**: \`${
					payload.options.alias
				}\` has been mentioned in a ${packet.data.type} from \`${
					packet.data.sender
				}\`:\n> ${packet.data.message}`,
			);
		} else if (packet.type === MessageType.WARNING) {
			channel.send(
				`${discordConfig.whitelist
					.map(u => `<@${u}>`)
					.join(' ')}\n**WARNING** (from \`${payload.options.alias}\`): ${
					packet.data.message
				}`,
			);

			return;
		} else if (packet.type === MessageType.STAFF_JOIN) {
			channel.send(`\`[${packet.data.title}] ${packet.data.name}\` has joined`);
		} else if (packet.type === MessageType.STAFF_LEAVE) {
			channel.send(`\`[${packet.data.title}] ${packet.data.name}\` has left`);
		} else if (packet.type === MessageType.STAFF_VANISH) {
			channel.send(
				`\`[${packet.data.title}] ${packet.data.name}\` has vanished`,
			);
		} else if (packet.type === MessageType.STAFF_UNVANISH) {
			channel.send(
				`\`[${packet.data.title}] ${packet.data.name}\` has unvanished`,
			);
		}
	};

	worker.on('message', messageHandler);

	worker.once('error', async error => {
		console.error(payload.options.alias, error);

		worker.off('message', messageHandler);
		worker.terminate();
	});

	worker.once('exit', async code => {
		worker.off('message', messageHandler);

		if (code === 0) {
			await sleep(10_000);

			if (payload.options.expires && payload.options.expires - Date.now()) {
				const data = await generateAlteningToken();

				if (data === null) {
					return console.log(
						`         ${' '.repeat(17)}${chalk.bold(
							chalk.cyan('Parent'),
						)} Permanently stopping worker ${chalk.yellow(
							payload.options.alias,
						)}`,
					);
				}

				payload.options.alias = data.token.slice(11);
				payload.options.username = data.token;
				payload.options.expires = data.expires;
			}

			startNewProcess(payload, workers, discord);
		} else {
			console.log(
				`         ${' '.repeat(17)}${chalk.bold(
					chalk.cyan('Parent'),
				)} Permanently stopping worker ${chalk.yellow(payload.options.alias)}`,
			);
		}
	});
}

export async function generateAlteningToken(): Promise<{
	token: string;
	expires: number;
} | null> {
	const { data, status } = await axios.get(
		'https://api.thealtening.com/free/generate',
		{
			headers: {
				cookie: 'tower=aaaaaaaaaaaaaaa; watch=aaaaaaaaaaaaaaaa',
			},
		},
	);

	if (status !== 200) return null;

	return { token: data.token, expires: new Date(data.expires).getTime() };
}

export async function runUntilSuccessful<T>(
	fn: (...args: any[]) => PromiseLike<T>,
	max: number = 5,
): Promise<T | undefined> {
	let result: T | undefined;

	while (max--) {
		try {
			result = await fn();
			break;
		} catch {}
	}

	return result;
}

export async function fetchStaffList(): Promise<Map<string, StaffMember>> {
	const { data: html } = await axios.get<string>(
		'https://thearchon.net/staff/',
	);
	const match = html.match(STAFF_LIST_REGEX);

	if (match === null) return new Map();

	const defaultList: [string, StaffMember][] = JSON.parse(
		await fs.readFile(
			path.join(__dirname, '..', 'resources', 'staff.json'),
			'utf8',
		),
	);
	const list: StaffCategory[] = JSON.parse(
		match[1].replace(FIX_OBJECT_REGEX, (_, a, b) => (a ? '"' : `"${b}":`)),
	);

	const map = new Map<string, StaffMember>(defaultList);

	for (const category of list) {
		for (const member of category.members) {
			member.name_lower = member.name.toLowerCase();
			map.set(member.name_lower, member);
		}
	}

	return map;
}

export function formatStaffList(list: Map<string, StaffMember>) {
	const mapped = [...list.values()].map(u => chalk.magenta(u.name));

	if (list.size === 1) return mapped[0];

	const last = mapped.pop();

	return `${mapped.join(chalk.white(', '))} ${chalk.white('and')} ${last}`;
}

export function escape(string: string) {
	return string.replaceAll('_', '\\_');
}

export function convertRawItem(item: RawItem): Item {
	return Item.fromNotch(item.item)!;
}
