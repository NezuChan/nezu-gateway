import { Time } from "@sapphire/time-utilities";
import { Task, TaskOptions } from "../Stores/Task.js";
import { Constants } from "../Utilities/Constants.js";
import { ApplyOptions } from "../Utilities/Decorators/ApplyOptions.js";
import { Result } from "@sapphire/result";

@ApplyOptions<TaskOptions>({
    taskOptions: {
        name: "spawnNewShardTask",
        data: {},
        options: {
            delay: Time.Minute * 20
        }
    },
    enabled: process.env.AUTO_SPAWN_SHARDS === "true"
})

export class SpawnNewShardTask extends Task {
    public async run(): Promise<void> {
        const previousTask = await this.container.gateway.redis.hget(Constants.SPAWN_NEW_SHARD_TASK, "lastRun");
        if (previousTask) return this.container.gateway.logger.warn("Possible dupe [spawnNewShardTask] task, skipping...");

        this.container.gateway.logger.info("Spawning new shard...");
        const sessionInfo = await this.container.gateway.ws.fetchGatewayInformation(true);
        const shardCount = await this.container.gateway.ws.getShardCount();

        await this.container.gateway.redis.hset(Constants.SPAWN_NEW_SHARD_TASK, "lastRun", Date.now());
        await this.container.gateway.redis.expire(Constants.SPAWN_NEW_SHARD_TASK, (Time.Minute * 20) - (Time.Second * 10));

        await this.container.gateway.tasks.sender.post({
            name: this.name,
            options: this.options.taskOptions.options,
            type: "add",
            data: this.options.taskOptions.data
        });

        if (sessionInfo.shards !== shardCount) {
            await this.container.gateway.ws.updateShardCount(sessionInfo.shards);
            await this.container.gateway.redis.set(Constants.SHARDS_KEY, shardCount);

            return this.container.gateway.logger.info(`Spawned new shards, shard count is now ${sessionInfo.shards}`);
        }

        this.container.gateway.logger.info("No need to spawn new shards, it's already at the maximum shard count.");
    }

    public override onLoad(): unknown {
        void Result.fromAsync(async () => {
            const previousTask = await this.container.gateway.redis.hget(Constants.SPAWN_NEW_SHARD_TASK, "lastRun");
            if (previousTask) return this.container.gateway.logger.warn("Possible dupe [spawnNewShardTask] task, skipping...");

            await this.container.gateway.tasks.sender.post({
                name: this.name,
                options: this.options.taskOptions.options,
                type: "add",
                data: this.options.taskOptions.data
            });

            await this.container.gateway.redis.hset(Constants.SPAWN_NEW_SHARD_TASK, "lastRun", Date.now());
            await this.container.gateway.redis.expire(Constants.SPAWN_NEW_SHARD_TASK, (Time.Minute * 20) - (Time.Second * 10));
        });
        this.container.gateway.tasks.receiver.on(this.name, this._run.bind(this));
        return super.onLoad();
    }
}
