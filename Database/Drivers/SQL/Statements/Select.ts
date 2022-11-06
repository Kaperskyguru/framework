import { BaseStatement } from './BaseStatement'
import { StringExpression } from '../../..'
import { wrap } from '../../../Helpers'

export class Select extends BaseStatement {
    get distinct() {
        return this.components.distinct ? 'DISTINCT ' : ''
    }

    get columns() {
        let columns = this.components.columns || []
        columns = columns.map(column => {
            return column instanceof StringExpression ? column.value : wrap(column)
        })

        const aggregate = this.components.aggregate
        if (aggregate) {
            columns.push(`${aggregate.function}(${wrap(aggregate.columns) || '*'}) as aggregate`)
        }

        if (!columns.length) {
            return '*'
        }

        return columns.join(', ')
    }

    get wheres() {
        if (!this.components.wheres.length) {
            return ''
        }

        return `WHERE ${super.wheres}`
    }

    toSQL() {
        return `
            SELECT ${this.distinct}${this.columns}
            FROM ${this.table} ${this.joins} ${this.wheres} ${this.groups}
                ${this.having}
                ${this.orders}
                ${this.limit}
        `
    }
}

/*
const query = `SELECT *
		   FROM users
		   where name = 'john'                  --  where basic
			  or (age in (1, 2, 3) and age > 2) -- where nested
			  or age in (1, 2, 3)               -- where in
			  or age in (SELECT age from users) -- where subSelect
`;
*/
