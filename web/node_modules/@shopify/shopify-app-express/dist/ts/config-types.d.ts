import { ApiVersion, ConfigParams as ApiConfigParams, Shopify, ShopifyRestResources } from '@shopify/shopify-api';
import { SessionStorage } from '@shopify/shopify-app-session-storage';
export type ExpressApiConfigParams<Resources extends ShopifyRestResources = ShopifyRestResources> = Partial<ApiConfigParams<Resources>> & {
    apiVersion: ApiVersion;
};
export interface AppConfigParams<Resources extends ShopifyRestResources = ShopifyRestResources, Storage extends SessionStorage = SessionStorage> {
    auth: AuthConfigInterface;
    webhooks: WebhooksConfigInterface;
    api: ExpressApiConfigParams<Resources>;
    useOnlineTokens?: boolean;
    exitIframePath?: string;
    sessionStorage?: Storage;
}
export interface AppConfigInterface<Resources extends ShopifyRestResources = ShopifyRestResources, Storage extends SessionStorage = SessionStorage> extends Omit<AppConfigParams<Resources, Storage>, 'api'> {
    logger: Shopify['logger'];
    useOnlineTokens: boolean;
    exitIframePath: string;
    sessionStorage: Storage;
}
export interface AuthConfigInterface {
    path: string;
    callbackPath: string;
    checkBillingPlans?: string[];
}
export interface WebhooksConfigInterface {
    path: string;
}
//# sourceMappingURL=config-types.d.ts.map