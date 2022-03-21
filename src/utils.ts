import characters from './characters';

import type { RawMapData } from './typings';

const CHARACTER_WIDTH = 12;
const CHARACTER_HEIGHT = 14;

export const currencyFormatter = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 2,
	minimumFractionDigits: 2,
});

function findCharacter(data: number[][], x: number, y: number) {
	for (const character in characters) {
		let match = true;

		// @ts-ignore
		const bits: number[] = characters[character];

		for (let j = 0; j < CHARACTER_HEIGHT; j++) {
			for (let i = 0; i < CHARACTER_WIDTH; i++) {
				const bit = data[y + j][x + i];

				if (bit === 2) return;

				if (bits[i + j * CHARACTER_WIDTH] !== bit) {
					match = false;
					break;
				}
			}

			if (!match) break;
		}

		if (match) {
			for (let j = 0; j < CHARACTER_HEIGHT; j++) {
				for (let i = 0; i < CHARACTER_WIDTH; i++) {
					data[y + j][x + i] = 2;
				}
			}

			return character;
		}
	}
}

export function formatMapData(json: RawMapData): number[][] {
	const data: number[][] = [];

	for (let x = 0; x < json.columns; x++) {
		for (let z = 0; z < json.rows; z++) {
			const colorId = json.data[x + z * json.columns];
			const bit = colorId === 119 || colorId === 34 ? 1 : 0;

			if (data[z]) data[z][x] = bit;
			else data[z] = [bit];
		}
	}

	return data;
}

export function unscramble(data: number[][]) {
	const rows = data.length;
	const columns = data[0].length;

	const characters = [];

	for (let y = 0; y < rows - CHARACTER_WIDTH; ++y) {
		for (let x = 0; x < columns - CHARACTER_HEIGHT; ++x) {
			try {
				const character = findCharacter(data, x, y);

				if (character) {
					characters.push(character);
				}
			} catch {}
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
