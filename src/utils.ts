import { Worker } from 'worker_threads';

import chalk from 'chalk';
import type { Client } from 'discord.js';
import { Configuration, OpenAIApi } from 'openai';

import characters from './characters';
import config, { discordConfig } from './config';
import { WORKER_PATH } from './constants';
import { MessageType, SellType } from './typings';
import type { BaseBotOptions, MessagePayload, RawMapData } from './typings';

const CHARACTER_WIDTH = 12;
const CHARACTER_HEIGHT = 14;

const configuration = new Configuration({
	apiKey: config.openai_key,
});

const openai = new OpenAIApi(configuration);

// prettier-ignore
const filter: string[][] = [
	['0', '2', '3', '6', '7', '8', '9', 'C', 'D', 'G', 'J', 'L', 'O', 'Q', 'U', 'V', 'W', 'Z'],
	['1', '4', '5', 'A', 'B', 'E', 'F', 'H', 'I', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'X', 'Y'],
	[],
];

export function random(max: number, min: number = 0) {
	return Math.floor(Math.random() * (max - min)) + min;
}

export async function generateResponse(
	prompt: string,
): Promise<string | undefined> {
	if (config.openai_key === undefined) return undefined;

	const { data: response } = await openai.createAnswer({
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
	});

	if (response.answers === undefined || response.answers.length === 0)
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
	const rows = json.rows;
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

export function sleep(ms: number): Promise<true> | undefined {
	if (ms <= 0) return;

	return new Promise(r => setTimeout(r, ms, true));
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
	client: Client | null,
) {
	console.log(
		`${' '.repeat(17)}${chalk.bold(
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
				`${' '.repeat(17)}${chalk.bold(chalk.cyan('Parent'))} ${chalk.yellow(
					payload.options.alias,
				)} is ${
					packet.data.is_fishing ? 'fishing' : 'not fishing'
				} and trading for ${
					packet.data.sell_type === SellType.COINS ? 'coins' : 'mob coins'
				}`,
			);

			payload.options.fish = packet.data.is_fishing;
			payload.options.sell_type = packet.data.sell_type;

			return;
		}

		const channel = discordConfig.channels.notifications
			? client?.channels.cache.get(discordConfig.channels.notifications)
			: undefined;

		if (channel?.type === 'GUILD_TEXT') {
			channel.send(
				`${discordConfig.whitelist
					.map(u => `<@${u}>`)
					.join(' ')}\n**NOTIFICATION**: \`${
					payload.options.alias
				}\` has been mentioned in a ${packet.data.type} from \`${
					packet.data.sender
				}\`:\n> ${packet.data.message}`,
			);
		}
	};

	worker.on('message', messageHandler);

	worker.once('error', async error => {
		console.error(payload.options.alias, error);

		worker.removeListener('message', messageHandler);
		worker.terminate();
	});

	worker.once('exit', async code => {
		worker.removeListener('message', messageHandler);

		if (code === 0) {
			await sleep(10_000);

			startNewProcess(payload, workers, client);
		} else {
			console.log(
				`${' '.repeat(17)}${chalk.bold(
					chalk.cyan('Parent'),
				)} Permanently stopping worker ${chalk.yellow(payload.options.alias)}`,
			);
		}
	});
}
