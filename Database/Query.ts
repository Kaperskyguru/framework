import {
    Boolean,
    Components,
    Direction,
    JoinType,
    Operator,
    SqlValue,
    SqlValueMap,
    Where,
    WhereBetween,
    WhereFunction,
    WhereIn,
    WhereLike,
    WhereNull,
    WhereSubSelect,
    WhereValue
} from './Types'
import { Select } from './Statements/Select'
import { Insert } from './Statements/Insert'
import { Statement } from './Statements/Statement'
import { Delete } from './Statements/Delete'
import { Update } from './Statements/Update'
import { Connection } from './Connection'
import { Expression } from './Expression'

export class Query<T = {}> {
    static connection: Connection
    private statementType: new(c: Components) => Statement = Select

    private useDistinct = false

    private components: Components = {
        table: '',
        distinct: false,
        columns: [],
        joins: [],
        wheres: [],
        groups: [],
        orders: [],
        having: [],
    }

    get statement(): Statement {
        return new this.statementType(this.components)
    }

    static table<T = {}>(table: string): Query<T> {
        return (new this as Query<T>).table(table)
    }

    static from<T = {}>(table: string) {
        return Query.table<T>(table)
    }

    static async lastInsertedId(): Promise<number | string> {
        return await Query.connection.lastInsertedId()
    }

    getBindings() {
        const statement = this.statement
        statement.toSql()
        return statement.bindings
    }

    toSql() {
        const statement = this.statement
        const sql = statement.toSql()
        return sql.replace(/\s{2,}/g, ' ').trim()
    }

    async get<K extends keyof T>(...columns: (K | string | Expression)[]): Promise<T[]> {
        return Query.connection.get(this.select(...(columns.length ? columns : this.components.columns)))
    }

    async run<K extends keyof T>(): Promise<void> {
        await Query.connection.run(this)
    }

    table(table: string) {
        this.components.table = table

        return this
    }

    from(table: string) {
        return this.table(table)
    }

    async first<K extends keyof T>(...columns: (K | string | Expression)[]): Promise<T | undefined> {
        return Query.connection.first(this.select(...(columns.length ? columns : this.components.columns)))
    }

    select<K extends keyof T>(...columns: (K | string | Expression)[]) {
        this.components.columns = columns as string[]

        return this
    }

    where<K extends keyof T>(
        column: K | string,
        operator: Operator | Query | WhereValue | WhereFunction | T[K],
        value?: Query | WhereValue | WhereFunction | T[K],
        boolean: Boolean = 'AND'
    ): this {
        // if (column instanceof Function) {
        //     const query = new WhereNested();
        //     this.components.wheres = query;
        //     column(query);
        //     return this;
        // }
        if (value === undefined) {
            value = operator
            operator = '=' as Operator
        }

        if (value instanceof Query) {
            this.components.wheres.push(new WhereSubSelect(column as string, operator as Operator, value, boolean))
            return this
        }

        if (typeof value === 'function') {
            const query = new Query()
            // @ts-ignore
            value(query)
            this.components.wheres.push(new WhereSubSelect(column as string, operator as Operator, query, boolean))
            return this
        }

        // this.bindings.push(value);
        // const where = new Where();
        // where.boolean = this.components.wheres.length ? boolean : 'WHERE';
        // this.components.wheres.push({
        //     column, operator, value, boolean
        // });

        if (typeof value === 'object') {
            return this
        }

        this.components.wheres.push(new Where(column as string, operator as Operator, value as WhereValue, boolean))

        return this
    }

    orWhere<K extends keyof T>(column: K | string, operator: Operator | WhereValue | T[K], value?: WhereValue | T[K]): this {
        return this.where(column, operator, value, 'OR')
    }

    andWhere<K extends keyof T>(column: K | string, operator: Operator | WhereValue | T[K], value?: WhereValue | T[K]): this {
        return this.where(column, operator, value)
    }

    whereIn<K extends keyof T>(
        column: K | string,
        values: Query | WhereFunction | WhereValue[] | T[K][],
        boolean: Boolean = 'AND',
        not = false
    ): this {
        if (values instanceof Query) {
            this.components.wheres.push(new WhereSubSelect(column as string, not ? 'NOT IN' : 'IN', values, boolean))
            return this
        }
        if (typeof values === 'function') {
            const query = new Query()
            values(query)
            this.components.wheres.push(new WhereSubSelect(column as string, not ? 'NOT IN' : 'IN', query, boolean))
            return this
        }
        this.components.wheres.push(new WhereIn(column as string, values as WhereValue[], boolean, not))

        return this
    }

    andWhereIn<K extends keyof T>(column: K | string, values: SqlValue[]): this {
        return this.whereIn(column, values)
    }

    whereLike<K extends keyof T>(column: K | string, value: SqlValue, boolean: Boolean = 'AND', not = false): this {
        this.components.wheres.push(new WhereLike(column as string, value, boolean, not))

        return this
    }

    whereNotIn<K extends keyof T>(
        column: K | string,
        values: Query | WhereFunction | WhereValue[] | T[K][],
        boolean: Boolean = 'AND'
    ): this {
        return this.whereIn(column, values, boolean, true)
    }

    orWhereIn<K extends keyof T>(column: K | string, values: SqlValue[]): this {
        return this.whereIn(column, values, 'OR')
    }

    orWhereNotIn<K extends keyof T>(column: K | string, values: SqlValue[]): this {
        return this.whereIn(column, values, 'OR', true)
    }

    orWhereLike<K extends keyof T>(column: K | string, value: SqlValue, not = false): this {
        return this.whereLike(column, value, 'OR', not)
    }

    orWhereNotLike<K extends keyof T>(column: K | string, value: SqlValue): this {
        return this.whereLike(column, value, 'OR', true)
    }

    whereBetween<K extends keyof T>(column: K | string, values: [SqlValue, SqlValue], boolean: Boolean = 'AND', not = false): this {
        this.components.wheres.push(new WhereBetween(column as string, values, boolean, not))

        return this
    }

    whereNotBetween<K extends keyof T>(column: K | string, values: [SqlValue, SqlValue], boolean: Boolean = 'AND'): this {
        return this.whereBetween(column, values, boolean, true)
    }

    orWhereBetween<K extends keyof T>(column: K | string, values: [SqlValue, SqlValue]): this {
        return this.whereBetween(column, values, 'OR')
    }

    orWhereNotBetween<K extends keyof T>(column: K | string, values: [SqlValue, SqlValue]): this {
        return this.whereBetween(column, values, 'OR', true)
    }

    whereNull<K extends keyof T>(column: K | string, boolean: Boolean = 'AND', not = false): this {
        this.components.wheres.push(new WhereNull(column as string, boolean, not))

        return this
    }

    andWhereNull<K extends keyof T>(column: K | string): this {
        return this.whereNull(column)
    }

    whereNotNull<K extends keyof T>(column: K | string, boolean: Boolean = 'AND'): this {
        return this.whereNull(column, boolean, true)
    }

    andWhereNotNull<K extends keyof T>(column: K | string, boolean: Boolean = 'AND'): this {
        return this.whereNotNull(column, boolean)
    }

    orWhereNull<K extends keyof T>(column: K | string): this {
        return this.whereNull(column, 'OR')
    }

    orWhereNotNull<K extends keyof T>(column: K | string): this {
        return this.whereNull(column, 'OR', true)
    }

    distinct(value = true) {
        this.components.distinct = value

        return this
    }

    join(table: string, first: string, operator: Operator, second: string, type: keyof typeof JoinType = JoinType.INNER) {
        this.components.joins.push({type, table, first, operator, second})

        return this
    }

    innerJoin(table: string, first: string, operator: Operator, second: string) {
        return this.join(table, first, operator, second, JoinType.INNER)
    }

    leftJoin(table: string, first: string, operator: Operator, second: string) {
        return this.join(table, first, operator, second, JoinType.LEFT)
    }

    rightJoin(table: string, first: string, operator: Operator, second: string) {
        return this.join(table, first, operator, second, JoinType.RIGHT)
    }

    orderBy<K extends keyof T>(column: K | [string | K, Direction][], direction: Direction = 'DESC') {
        if (typeof column === 'string') {
            column = [[column, direction]]
        }
        this.components.orders = column as [string, Direction][]

        return this
    }

    groupBy<K extends keyof T>(...columns: (K | string) []) {
        this.components.groups = columns as string[]

        return this
    }

    addSelect<K extends keyof T>(...columns: (K | string | Expression)[]) {
        this.components.columns = this.components.columns.concat(columns as string[])

        return this
    }

    async count<K extends keyof T>(...columns: (K | string | Expression)[]): Promise<number> {
        this.components.aggregate = {
            function: 'COUNT',
            columns: columns as string[],
        }
        const value = await Query.connection.first(this as unknown as Query<{aggregate: number}>)
        return value?.aggregate || 0
    }

    selectCount<K extends keyof T>(...columns: (K | string | Expression)[]): this {
        this.components.aggregate = {
            function: 'COUNT',
            columns: columns as string[],
        }
        return this
    }

    async max<K extends keyof T>(column: (K | string | Expression), ...columns: (K | string | Expression)[]): Promise<T[]> {
        this.components.aggregate = {
            function: 'MAX',
            columns: [column].concat(columns) as string[],
        }
        return Query.connection.get(this)
    }

    async insert(data: SqlValueMap | SqlValueMap[]) {
        this.statementType = Insert

        if (!Array.isArray(data)) {
            data = [data]
        }

        this.components.insert = data

        await this.run()
    }

    async delete() {
        this.statementType = Delete

        await this.run()
    }

    async update(name: string | keyof T | Record<keyof T, SqlValue> | SqlValueMap, value?: SqlValue) {
        this.statementType = Update

        let data: SqlValueMap
        if (typeof name === 'string') {
            data = {[name]: value}
        } else {
            data = name as SqlValueMap
        }

        this.components.update = data

        await this.run()
    }

    limit<K extends keyof T>(from: number, count?: number) {
        this.components.limit = {from, count}

        return this
    }
}
