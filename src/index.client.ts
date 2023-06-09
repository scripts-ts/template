import { Players, RunService } from "@rbxts/services";

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

/**
 * A base class for components to extend.
 */
class BaseComponent<I extends Instance = Instance> implements OnInit, OnStart, Destroyable {
	public readonly instance: I;
	public readonly _cleanup = new Bin();

	private active = false;
	private destructed = false;

	constructor(instance: I) {
		this.instance = instance;
	}

	public run() {
		this.onInit();
		if (!this.destructed) this.onStart();
	}

	public isActive() {
		return this.active;
	}

	public onInit(): void {
		const { instance } = this;
		this._cleanup.add(instance.Destroying.Connect(() => this.destroy()));
	}

	public onStart(): void {
		this.active = true;
	}

	public destroy(): void {
		if (this.destructed) return;
		this._cleanup.destroy();
		this.destructed = true;
		this.active = false;
	}
}

/**
 * A base class for controllers to extend.
 */
class BaseController implements OnInit, OnStart, Destroyable {
	public readonly _cleanup = new Bin();
	private active = false;
	private destructed = false;

	public isActive() {
		return this.active;
	}

	public onInit(): void {}

	public onStart(): void {
		this.active = true;
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

interface OnTick {
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
	constructor(instance: Model, player?: Player) {
		super(instance, player);
		task.defer(() => this.run());
	}

	public run(): void {
		super.run();
		EntityComponent.attached.set(this.instance, this);
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

	private static attached = new Map<Model, EntityComponent>();
	public static getComponent(instance: Model) {
		return EntityComponent.attached.get(instance);
	}
	public static getComponents() {
		return this.attached;
	}
}

class AvatarComponent extends CharacterComponent {
	constructor(instance: Model, player?: Player) {
		super(instance, player);
		task.defer(() => this.run());
	}

	public run(): void {
		super.run();
		AvatarComponent.attached = this;
	}

	private static attached: AvatarComponent | undefined;
	public static getComponent() {
		return AvatarComponent.attached;
	}
	public static getComponents() {
		return this.attached;
	}
}

/*
	-----------------------
	Controller Declarations
	-----------------------
	All the controllers that are used in the code are declared here.

*/
class ComponentController extends BaseController {
	private static instance = new ComponentController();
	public static getInstance() {
		return ComponentController.instance;
	}

	public onInit(): void {}

	public onStart(): void {}
}

class LifecycleController extends BaseController implements OnTick, OnRender, OnPhysics {
	public onStart(): void {
		RunService.PreRender.Connect((dt) => this.onRender(dt));
		RunService.PreSimulation.Connect((dt) => this.onPhysics(dt));
		RunService.PostSimulation.Connect((dt) => this.onTick(dt));
	}

	public onTick(dt: number): void {}
	public onRender(dt: number): void {}
	public onPhysics(dt: number): void {}

	private static instance = new LifecycleController();
	public static getInstance() {
		return LifecycleController.instance;
	}
}

/*
	----------------------
	Initiation & Execution
	----------------------
	All the code that is executed on startup is placed here.

*/
// Controllers - Initiation
const controllers = [LifecycleController.getInstance(), ComponentController.getInstance()];
const max = controllers.size() - 1;
for (const i of $range(0, max)) controllers[i].onInit();
for (const i of $range(0, max)) task.defer(() => controllers[i].onStart());
