import fs from 'fs';
import path from 'path';

import axios from 'axios';
import chalk from 'chalk';
import unzipper from 'unzipper';
import type { Entry } from 'unzipper';

export async function check() {
	const { data } = await axios.get(
		'https://raw.githubusercontent.com/matteopolak/thearchon/main/package.json',
	);

	if (data.version !== process.env.npm_package_version) {
		console.log(
			`${' '.repeat(26)}${chalk.green(
				chalk.bold('Update'),
			)} An update is available: ${chalk.bgGreen(
				data.version,
			)} (${chalk.underline('npm run update')})`,
		);
	}
}

export async function update() {
	const { data } = await axios.get(
		'https://raw.githubusercontent.com/matteopolak/thearchon/main/package.json',
	);

	if (data.version === process.env.npm_package_version) {
		return console.log(
			`${' '.repeat(26)}${chalk.green(
				chalk.bold('Update'),
			)} No update available!`,
		);
	}

	const { data: stream } = await axios.get<NodeJS.ReadableStream>(
		'https://github.com/matteopolak/thearchon/archive/refs/heads/main.zip',
		{
			responseType: 'stream',
		},
	);

	stream
		.pipe(unzipper.Parse({ path: path.join(__dirname, '..') }))
		.on('entry', async (entry: Entry) => {
			const location = path.join(
				__dirname,
				'..',
				entry.path.replace(/^[\w-]+\//g, ''),
			);

			if (entry.type === 'Directory') {
				fs.mkdirSync(location, { recursive: true });
			} else {
				fs.writeFileSync(
					path.join(__dirname, '..', entry.path.replace(/^[\w-]+\//g, '')),
					await entry.buffer(),
				);
			}
		});

	return new Promise<void>(resolve =>
		stream.once('close', () => {
			console.log(
				`${' '.repeat(26)}${chalk.green(
					chalk.bold('Update'),
				)} Successfully updated: ${chalk.bgRed(
					process.env.npm_package_version,
				)} > ${chalk.bgGreen(data.version)}`,
			);

			resolve();
		}),
	);
}

if (process.argv[2] === '--update') {
	update();
}
