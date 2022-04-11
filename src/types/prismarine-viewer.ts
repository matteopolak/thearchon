declare module 'prismarine-viewer' {
	import type { Bot } from 'mineflayer';

	export function mineflayer(bot: Bot, options: { port: number }): void;
}
