import * as vscode from 'vscode';
import * as crypto from 'crypto';

export class TelemetryService {
    private readonly installationId: string;
    private readonly globalState: vscode.Memento;
    private readonly defaultEndpoint = 'https://codedraft-telementry.vercel.app/api/collect';

    constructor(globalState: vscode.Memento) {
        this.globalState = globalState;
        this.installationId = this.getOrGenerateInstallationId();
    }

    async initialize(): Promise<void> {
        // Track installation (one-time) and update activation
        await this.trackStartupEvents();
        console.log('Telemetry initialized. Installation ID:', this.installationId);
    }

    private getOrGenerateInstallationId(): string {
        let id = this.globalState.get<string>('telemetry.installationId');
        if (!id) {
            id = crypto.randomUUID();
            this.globalState.update('telemetry.installationId', id);
        }
        return id;
    }

    async sendEvent(eventName: string, params: Record<string, any> = {}): Promise<void> {
        if (!this.isTelemetryEnabled() && eventName !== 'activation' && eventName !== 'installation') {
            return;
        }

        const endpoint = this.getEndpoint();
        const payload = {
            client_id: this.installationId,
            events: [{
                name: eventName,
                params: {
                    ...params,
                    session_id: Date.now().toString() // Simple session tracking
                }
            }]
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.warn(`Failed to send telemetry event '${eventName}': ${response.statusText}`);
            }
        } catch (error) {
            console.error(`Error sending telemetry event '${eventName}':`, error);
        }
    }

    private isTelemetryEnabled(): boolean {
        return vscode.workspace.getConfiguration('codedraft').get<boolean>('telemetry.enabled', true);
    }

    private getEndpoint(): string {
        const configEndpoint = vscode.workspace.getConfiguration('codedraft').get<string>('telemetry.endpoint');
        return configEndpoint && configEndpoint.trim().length > 0 ? configEndpoint : this.defaultEndpoint;
    }

    private async trackStartupEvents(): Promise<void> {
        // Wait a few seconds to not block startup
        setTimeout(async () => {
            const version = vscode.extensions.getExtension('timadey.codedraft')?.packageJSON.version || 'unknown';

            // 1. Check for one-time installation tracking
            const hasSentInstall = this.globalState.get<boolean>('telemetry.hasSentInstall');
            if (!hasSentInstall) {
                await this.sendEvent('installation', { version });
                await this.globalState.update('telemetry.hasSentInstall', true);
            }

            // 2. Track activation (active user pings)
            await this.sendEvent('activation', { version });
        }, 5000);
    }
}
