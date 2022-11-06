import { MigrationHistory } from './MigrationHistory'
import { Migration } from './Migration'
import * as path from 'path'
import { File, Storage } from '@Typetron/Storage'
import { Connection } from '..'
import { Constructor } from '@Typetron/Support'

interface MigrateOptions {
    fresh?: boolean;
}

export class Migrator {

    constructor(
        public storage: Storage,
        public connection: Connection,
        public directory: string
    ) {}

    async files(): Promise<File[]> {
        return this.storage.files(this.directory, true).where('extension', 'ts')
    }

    public async migrate(options?: MigrateOptions): Promise<boolean> {
        await this.createMigrationTable()

        if (options?.fresh) {
            await this.clearTable()
        }

        const files = await this.files()
        const migrates = await MigrationHistory.whereIn('name', files.pluck('name')).get()
        const filesToMigrate = files.filter(file => !migrates.findWhere('name', file.name))

        if (!filesToMigrate.length) {
            console.log('Nothing to migrate')
            return true
        }

        const lastBatch = await this.getLastBatchId()
        for await(const file of filesToMigrate) {
            const migration = this.getMigration(file.path)
            const migrationName = migration.constructor.name

            console.log(`Migrating '${migrationName}'`)
            try {
                await migration.up()
                await MigrationHistory.create({
                    name: file,
                    batch: lastBatch + 1,
                    createdAt: new Date()
                })
                console.log(`Migrated '${migrationName}'`)
            } catch (error) {
                console.error(`Failed to run the migration from '${migrationName}'`, (error as Error).message)
                return false
            }
        }
        return true
    }

    public async rollback(steps = 0) {
        await this.createMigrationTable()

        const lastMigration = await MigrationHistory.newQuery().orderBy('batch', 'DESC').first()
        if (!lastMigration) {
            throw new Error('Can not find any migration to rollback.')
        }
        const migrations = await MigrationHistory
            .where('batch', '>=', Math.max(0, lastMigration.batch - steps))
            .orderBy('batch', 'DESC')
            .get()

        for (const migrationEntity of migrations) {
            const migration = this.getMigration(path.join(this.directory, migrationEntity.name))
            const migrationName = migration.constructor.name

            console.log(`Rolling back the '${migrationName}' migration.`)
            try {
                await migration.down()
                console.log(`Reverted '${migrationName}' migration.`)
                await migrationEntity.delete()
            } catch (error) {
                console.error(`Failed to run the migration '${migrationName}'`, error)
                return false
            }
        }

        return true
    }

    protected async getLastBatchId(): Promise<number> {
        const lastMigration = await MigrationHistory.orderBy('batch', 'DESC').first()
        return lastMigration?.batch ?? 0
    }

    public async reset() {
        await this.createMigrationTable()

        const lastMigration = await MigrationHistory.newQuery().orderBy('batch', 'DESC').first()

        if (!lastMigration) {
            return true
        }

        return this.rollback(lastMigration?.batch)
    }

    private getMigration(migrationFilePath: string): Migration {
        const migrationModule: Record<string, Constructor<Migration>> = require(migrationFilePath)
        const MigrationClass = Object.values(migrationModule)[0]
        return new MigrationClass(this.connection)
    }

    protected async createMigrationTable(): Promise<void> {
        await this.connection.driver.schema.synchronize([MigrationHistory].pluck('metadata'))
    }

    protected async clearTable(): Promise<unknown> {
        return MigrationHistory.truncate()
    }
}
