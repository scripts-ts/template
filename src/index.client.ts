import { Players } from "@rbxts/services";

/*
	------------------------
	Libraries | Dependencies
	------------------------
	All the libraries and dependencies that are used throughout the code.
	
*/

/*
	Bin
	Tracks connections, instances, functions, threads, and objects to be later destroyed.
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
	public add(item: Bin.Item, method?: string) {
		const node: Node = { item, method };
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

namespace Bin {
	export type Item = (() => unknown) | RBXScriptConnection | thread | { destroy(): void } | { Destroy(): void };
}
type Node = { next?: Node; item: Bin.Item; method?: string };

/*
	Framework
	A framework for easy and organized development.
*/
class BaseComponent<I extends Instance = Instance> implements OnInit, OnStart, Destroyable {
	public readonly instance: I;
	public readonly _cleanup = new Bin();

	private active = false;
	private destructed = false;

	constructor(instance: I) {
		this.instance = instance;
	}

	/** @hidden */
	public run() {
		this.onInit();
		if (!this.destructed) this.onStart();
	}

	public onInit(): void {
		const { instance } = this;
		this._cleanup.add(instance.Destroying.Connect(() => this.destroy()));
	}

	public onStart(): void {
		this.active = true;
	}

	public isActive() {
		return this.active;
	}

	public destroy(): void {
		if (this.destructed) return;
		this._cleanup.destroy();
		this.destructed = true;
		this.active = false;
	}
}

class BaseController implements OnInit, OnStart, Destroyable {
	public readonly _cleanup = new Bin();
	private active = false;
	private destructed = false;

	public onInit(): void {}

	public onStart(): void {
		this.active = true;
	}

	public isActive() {
		return this.active;
	}

	public destroy(): void {
		if (this.destructed) return;
		this._cleanup.destroy();
		this.destructed = true;
		this.active = false;
	}
}

interface OnInit {
	onInit(): void;
}

interface OnStart {
	onStart(): void;
}

interface onTick {
	onTick(dt: number): void;
}

interface OnRender {
	onRender(dt: number): void;
}

interface OnPhysics {
	onPhysics(dt: number): void;
}

interface Destroyable {
	destroy(): void;
}

/*
	----------------------
	Variables & References
	----------------------
	Holds all the variables and references that are used throughout the code.

*/
const LocalPlayer = Players.LocalPlayer;

/*
	----------------------
	Component Declarations
	----------------------
	All the components that are used in the code are declared here.

*/
class CharacterComponent extends BaseComponent<Model> {
	public readonly root: BasePart;
	public readonly humanoid: Humanoid;
	public readonly client: Player | undefined;

	public readonly tools = new Array<Tool>();
	private readonly _tools = new Set<Tool>();
	public readonly equipped = new Set<Tool>();

	constructor(instance: Model, client?: Player) {
		super(instance);
		this.client = client;
		this.root = instance.WaitForChild("HumanoidRootPart", 5) as BasePart;
		this.humanoid = instance.WaitForChild("Humanoid", 5) as Humanoid;
		task.defer(() => this.run());
	}

	public onInit(): void {
		const client = this.client;
		const instance = this.instance;

		// Tools Check
		if (client) {
			const backpack = client.WaitForChild("Backpack", 5) as Backpack;
			backpack.ChildAdded.Connect((item) => this.onPossibleTool(item));
			backpack.GetChildren().forEach((item) => this.onPossibleTool(item));
		}
		instance.ChildAdded.Connect((item) => this.onPossibleTool(item));
		instance.GetChildren().forEach((item) => this.onPossibleTool(item));
	}

	public onTool(tool: Tool): void {
		const { tools, _tools, equipped } = this;

		const ancestry = tool.AncestryChanged.Connect((_, parent) => {
			if (parent === this.instance) this.onEquipped(tool);
			else if (parent !== undefined) this.onUnequipped(tool);
		});
		this._cleanup.add(ancestry).add(
			tool.Destroying.Connect(() => {
				ancestry.Disconnect();
				_tools.delete(tool);
				equipped.delete(tool);
				tools.remove(tools.indexOf(tool));
			}),
		);
	}

	public onEquipped(tool: Tool): void {
		this.equipped.add(tool);
	}

	public onUnequipped(tool: Tool): void {
		this.equipped.delete(tool);
	}

	private onPossibleTool(tool: Instance) {
		const { tools, _tools } = this;
		if (tool.IsA("Tool") && !_tools.has(tool as Tool)) {
			tools.push(tool);
			_tools.add(tool);
			this.onTool(tool);
		}
	}
}

class EntityComponent extends CharacterComponent {
	public static attached = new Map<Model, EntityComponent>();

	constructor(instance: Model, player?: Player) {
		super(instance, player);
		task.defer(() => this.run());
		EntityComponent.attached.set(instance, this);
	}

	public onInit(): void {
		super.onInit();
		this._cleanup.add(this.instance.AncestryChanged.Connect((_, parent) => parent === undefined && this.destroy()));
	}

	public onEquipped(tool: Tool): void {
		super.onEquipped(tool);
		print(`Equipped ${tool.Name}`);
	}

	public onUnequipped(tool: Tool): void {
		super.onUnequipped(tool);
		print(`Unequipped ${tool.Name}`);
	}

	public destroy(): void {
		super.destroy();
	}
}

class AvatarComponent extends CharacterComponent {
	public static attached: AvatarComponent | undefined;

	constructor(instance: Model, player?: Player) {
		super(instance, player);
		task.defer(() => this.run());
		AvatarComponent.attached = this;
	}
}

/*
	-----------------------
	Controller Declarations
	-----------------------
	All the controllers that are used in the code are declared here.

*/
class ExampleController extends BaseController implements OnInit, OnStart {
	public static instance = new this();
}

/*
	---------------
	Event Listeners
	---------------
	Register all the event listeners, and responds to them.

*/

/*
	----------------------
	Initiation & Execution
	----------------------
	All the code that is executed on startup is placed here.

*/
