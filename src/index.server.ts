import { Players } from "@rbxts/services";
import { Destructible, Node } from "types";

if (_G["program id"]) throw "This program is already running!";
_G["program id"] = true;

/************************************************************
 * CONFIGURATIONS
 * Description: User-defined settings and configurations
 * Last updated: Feb. 14, 2024
 ************************************************************/

/************************************************************
 * VARIABLES
 * Description: Variables referenced globally in the script
 * Last updated: Feb. 14, 2024
 ************************************************************/
const LocalPlayer = Players.LocalPlayer;

/************************************************************
 * UTILITIES
 * Description: Helper functions and classes
 * Last updated: Feb. 14, 2024
 ************************************************************/
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
	public add<T extends Destructible>(item: T): T {
		const node: Node = { item };
		this.head ??= node;
		if (this.tail) this.tail.next = node;
		this.tail = node;
		return item;
	}

	/**
	 * Adds multiple items into the Bin. This can be a:
	 * - `() => unknown`
	 * - RBXScriptConnection
	 * - thread
	 * - Object with `.destroy()` or `.Destroy()`
	 */
	public batch<T extends Destructible[]>(...args: T): T {
		for (const item of args) {
			const node: Node = { item };
			this.head ??= node;
			if (this.tail) this.tail.next = node;
			this.tail = node;
		}
		return args;
	}

	/**
	 * Destroys all items currently in the Bin:
	 * - Functions will be called
	 * - RBXScriptConnections will be disconnected
	 * - threads will be `task.cancel()`-ed
	 * - Objects will be `.destroy()`-ed
	 */
	public destroy(): void {
		while (this.head) {
			const item = this.head.item;
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
			this.head = this.head.next;
		}
	}

	/**
	 * Checks whether the Bin is empty.
	 */
	public isEmpty(): boolean {
		return this.head === undefined;
	}
}

/************************************************************
 * COMPONENTS
 * Description: Classes for specific entities/objects
 * Last updated: Feb. 14, 2024
 ************************************************************/
class BaseComponent<T extends Instance> {
	protected bin = new Bin();

	constructor(protected readonly instance: T) {}

	/**
	 * Terminates the component and all functionality.
	 */
	public destroy(): void {
		this.bin.destroy();
	}
}

/************************************************************
 * CONTROLLERS
 * Description: Singletons that are used once
 * Last updated: Feb. 14, 2024
 ************************************************************/
namespace ExampleController {
	export function __init() {}
}

/************************************************************
 * INITIALIZATION
 * Description: Initializes and starts the runtime
 * Last updated: Feb. 14, 2024
 ************************************************************/
ExampleController.__init();

export = "Initialized Successfully";
