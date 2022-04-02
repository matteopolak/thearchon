import characters from '../src/characters';
import type { RawMapData } from '../src/typings';

const CHARACTER_WIDTH = 12;
const CHARACTER_HEIGHT = 14;

// prettier-ignore
const filter: string[][] = [
	['0', '2', '3', '6', '7', '8', '9', 'C', 'D', 'G', 'J', 'L', 'O', 'Q', 'U', 'V', 'W', 'Z'],
	['1', '4', '5', 'A', 'B', 'E', 'F', 'H', 'I', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'X', 'Y'],
	[],
];

function findCharacterMapped(
	json: RawMapData,
	options: { x: number; y: number },
): string | undefined {
	for (const character of filter[
		json.data[options.x + 4 + (options.y + 4) * json.columns]
	]) {
		let match = true;

		const bits: number[] = characters[character as keyof typeof characters];

		for (let i = 0; i < CHARACTER_HEIGHT; i += 2) {
			for (let j = 0; j < CHARACTER_WIDTH; j += 2) {
				if (
					bits[j + i * CHARACTER_WIDTH] !==
					json.data[options.x + j + (options.y + i) * json.columns]
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

export function unscrambleMapped(json: RawMapData) {
	const rows = json.rows - CHARACTER_HEIGHT;
	const columns = json.columns - CHARACTER_WIDTH;

	const characters = [];
	const options = {
		x: 0,
		y: 0,
	};

	for (let y = 0; y < json.rows; ++y) {
		for (let x = 0; x < json.columns; ++x) {
			const index = x + y * json.columns;
			const value = json.data[index];

			json.data[index] = value === 119 || value === 34 ? 1 : 0;
		}
	}

	for (options.y = 0; options.y < rows; ++options.y) {
		for (options.x = 0; options.x < columns; ++options.x) {
			const character = findCharacterMapped(json, options);

			if (character) {
				characters.push(character);
			}
		}
	}

	return characters;
}

function findCharacter(
	json: RawMapData,
	options: { x: number; y: number },
): string | undefined {
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
