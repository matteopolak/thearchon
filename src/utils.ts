import characters from './characters';

import type { RawMapData } from './typings';

const CHARACTER_WIDTH = 12;
const CHARACTER_HEIGHT = 14;

export const currencyFormatter = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 2,
	minimumFractionDigits: 2,
});

function findCharacter(
	json: RawMapData,
	options: { x: number; y: number },
): string | undefined {
	for (const character in characters) {
		let match = true;

		const bits: number[] = characters[character as keyof typeof characters];

		for (let i = 0; i < CHARACTER_HEIGHT; i++) {
			for (let j = 0; j < CHARACTER_WIDTH; j++) {
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

export function sleep(ms: number) {
	if (ms <= 0) return;

	return new Promise(r => setTimeout(r, ms));
}

export function createPromiseResolvePair(): {
	promise: Promise<void>;
	resolve: () => void;
} {
	let resolve: any;
	const promise: Promise<void> = new Promise(r => (resolve = r));

	return { promise, resolve };
}
