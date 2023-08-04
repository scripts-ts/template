import { Players } from "@rbxts/services";

/*
	------------------------
	Libraries | Dependencies
	------------------------
	All the libraries and dependencies that are used throughout the code.
	
*/
/**
 * Tracks connections, instances, functions, threads, and objects to be later destroyed.
 */
class Bin {
	private head: Node | undefined;
	private tail: Node | undefined;

	/**
	 * Adds an item into the Bin. This can be a:
	 * - `() => unknown`
	 * - RBXScriptConnection
	 * - thread
	 * - Object with `.destroy()` or `.Destroy()`
	 */
	public add<I extends Bin.Item>(item: I) {
		const node: Node = { item };
		this.head ??= node;
		if (this.tail) this.tail.next = node;
		this.tail = node;
		return this;
	}

	/**
	 * Destroys all items currently in the Bin:
	 * - Functions will be called
	 * - RBXScriptConnections will be disconnected
	 * - threads will be `task.cancel()`-ed
	 * - Objects will be `.destroy()`-ed
	 */
	public destroy(): void {
		let head = this.head;
		while (head) {
			const { item } = head;
			if (typeIs(item, "function")) {
				item();
			} else if (typeIs(item, "RBXScriptConnection")) {
				item.Disconnect();
			} else if (typeIs(item, "thread")) {
				task.cancel(item);
			} else if ("destroy" in item) {
				item.destroy();
			} else if ("Destroy" in item) {
				item.Destroy();
			}
			head = head.next;
			this.head = head;
		}
	}

	/**
	 * Checks whether the Bin is empty.
	 */
	public isEmpty(): boolean {
		return this.head === undefined;
	}
}
namespace Bin {
	export type Item = (() => unknown) | RBXScriptConnection | thread | { destroy(): void } | { Destroy(): void };
}
type Node = { next?: Node; item: Bin.Item };

/*
	----------------------
	Variables & References
	----------------------
	Holds all the variables and references that are used throughout the code.

*/
const LocalPlayer = Players.LocalPlayer;

/*
	----------------------
	Initiation & Execution
	----------------------
	All the code that is executed on startup is placed here.

*/
export = 0;
