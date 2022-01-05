import { BaseConfig } from './BaseConfig'
import { MiddlewareInterface } from '../../Router'
import { Abstract, Type } from '../../Support'
import { Provider } from '../Provider'

export class AppConfig extends BaseConfig<AppConfig> {
    environment: string
    debug = true
    port: number
    websocketsPort?: number
    middleware: Abstract<MiddlewareInterface>[]
    providers: Type<Provider> []
    staticAssets?: {url: string, path: string, basePath?: boolean, indexFile?: string}[]
}
