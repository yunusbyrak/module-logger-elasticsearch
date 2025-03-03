import { Client } from '@elastic/elasticsearch';
import { Inject } from '@nestjs/common';
import { ElasticsearchLoggerOptions } from './ElasticsearchLoggerOptions';
import * as os from 'os';
import { ElasticsearchLoggerUtilities } from './ElasticsearchLoggerUtilities';
import { Search } from '@elastic/elasticsearch/api/requestParams';
import { TransportRequestPromise, RequestBody, Context, ApiResponse } from '@elastic/elasticsearch/lib/Transport';

export class ElasticsearchLoggerService {

    private readonly client: Client;
    private indexes_cache: Array<string> = [];

    public constructor(@Inject('CONFIG_OPTIONS') private readonly options: ElasticsearchLoggerOptions) {

        this.client = new Client(options.elasticsearchClientOptions);

    }

    public async createIndexIfNotExists(index: string, body?: any) {

        if (this.indexes_cache.indexOf(index) > -1) {

            return;

        }

        const result = await this.client.indices.exists({ index });

        if (result.statusCode !== 200) {

            await this.client.indices.create({

                index,
                body: body || {

                    mappings: {

                        properties: {

                            date: {

                                type: 'date'

                            },

                            hostname: { type: 'text' },
                            level: { type: 'keyword' },
                            body: { type: 'nested' }

                        }

                    }

                }

            });

        }

        this.indexes_cache.push(index);

    }

    /**
     * Primary log message handler.
     *
     * @param {string} level
     * @param message
     * @param indice
     */
    public async log<T>(level: string, message: T, indice?: string): Promise<string> {

        if (!!!indice) {

            indice = ElasticsearchLoggerUtilities.getRollingIndex(this.options.indexPrefix, this.options.rollingOffsetMode);

        }

        await this.createIndexIfNotExists(indice);

        const result = await this.client.index({

            index: indice,
            body: Object.assign({}, message, {

                date: new Date(),
                hostname: os.hostname(),
                level,

            })
        });

        if (this.options.stdout) {

            console.log(`[${ this.options.name }] ${ JSON.stringify(message) }`);

        }

        return result.body._id;

    }

    public async raw<T>(message: T, indice?: string): Promise<string> {

        if (!!!indice) {

            indice = ElasticsearchLoggerUtilities.getRollingIndex(this.options.indexPrefix, this.options.rollingOffsetMode);

        }

        await this.createIndexIfNotExists(indice);

        const result = await this.client.index({

            index: indice,
            body: message

        });

        if (this.options.stdout) {

            console.log(`[${ this.options.name }] ${ JSON.stringify(message) }`);

        }

        return result.body._id;

    }

    public async info<T>(message: T, indice?: string): Promise<string> {

        return this.log('info', message, indice);

    }

    public async error<T>(message: T, indice?: string): Promise<string> {

        return this.log('error', message, indice);

    }

    public async debug<T>(message: T, indice?: string): Promise<string> {

        return this.log('debug', message, indice);

    }

    public async warning<T>(message: T, indice?: string): Promise<string> {

        return this.log('warning', message, indice);

    }

    public async trace<T>(message: T, indice?: string): Promise<string> {

        return this.log('trace', message, indice);

    }

}
