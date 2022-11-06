import { BaseStatement } from './BaseStatement'

export class Update extends BaseStatement {

    get wheres() {
        if (!this.components.wheres.length) {
            return ''
        }

        return 'WHERE ' + super.wheres
    }

    get columns() {
        const columns = []
        const values = this.components.update || {}
        for (const column in values) {
            if (values.hasOwnProperty(column)) {
                this.bindings.push(values[column])
                columns.push(`${column} = ?`)
            }
        }
        return columns.join(', ')
    }

    toSQL() {
        return `
            UPDATE
                ${this.table}
            SET ${this.columns}
                    ${this.wheres} ${this.orders} ${this.limit}
        `
    }
}
