import characters from '../src/characters';

import type { RawMapData } from '../src/typings';

const CHARACTER_WIDTH = 12;
const CHARACTER_HEIGHT = 14;

function findCharacterOld(data: number[][], x: number, y: number) {
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

export function formatMapDataOld(json: RawMapData): number[][] {
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

export function unscrambleOld(data: number[][]) {
	const rows = data.length;
	const columns = data[0].length;

	const characters = [];

	for (let y = 0; y < rows - CHARACTER_HEIGHT; ++y) {
		for (let x = 0; x < columns - CHARACTER_WIDTH; ++x) {
			try {
				const character = findCharacterOld(data, x, y);

				if (character) {
					characters.push(character);
				}
			} catch {}
		}
	}

	return characters;
}

function findCharacterNew(
	json: RawMapData,
	x: number,
	y: number,
): string | undefined {
	for (const character in characters) {
		let match = true;

		// @ts-ignore
		const bits: number[] = characters[character];

		for (let i = 0; i < CHARACTER_HEIGHT; i++) {
			for (let j = 0; j < CHARACTER_WIDTH; j++) {
				const index = x + j + (y + i) * json.columns;

				if (json.data[index] === 2) return;

				const bit =
					json.data[index] < 3
						? json.data[index]
						: (json.data[index] =
								json.data[index] === 119 || json.data[index] === 34 ? 1 : 0);

				if (bits[j + i * CHARACTER_WIDTH] !== bit) {
					match = false;
					break;
				}
			}

			if (!match) break;
		}

		if (match) {
			for (let i = 0; i < CHARACTER_HEIGHT; i++) {
				for (let j = 0; j < CHARACTER_WIDTH; j++) {
					json.data[x + j + (y + i) * json.columns] = 2;
				}
			}

			return character;
		}
	}
}

export function unscrambleNew(json: RawMapData) {
	const rows = json.rows;
	const columns = json.columns;

	const characters = [];

	for (let y = 0; y < rows - CHARACTER_HEIGHT; ++y) {
		for (let x = 0; x < columns - CHARACTER_WIDTH; ++x) {
			const character = findCharacterNew(json, x, y);

			if (character) {
				x += CHARACTER_WIDTH;
				characters.push(character);
			}
		}
	}

	return characters;
}
