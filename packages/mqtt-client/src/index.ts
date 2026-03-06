/**
 * Unified MQTT Client for UNS Platform
 * Provides centralized MQTT connection management
 */

import mqtt, { MqttClient, IClientOptions } from 'mqtt';

export interface MQTTConfig {
  url: string;
  clientId?: string;
  username?: string;
  password?: string;
  clean?: boolean;
  keepalive?: number;
  reconnectPeriod?: number;
  protocolVersion?: 5 | 4 | 3;
}

export interface MessageHandler {
  (topic: string, payload: Buffer, packet: any): void;
}

class MQTTConnectionManager {
  private client: MqttClient | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionConfig: MQTTConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  async connect(config: MQTTConfig): Promise<MqttClient> {
    if (this.client?.connected) {
      return this.client;
    }

    this.connectionConfig = config;

    const options: IClientOptions = {
      clientId: config.clientId || `uns-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clean: config.clean ?? true,
      keepalive: config.keepalive ?? 60,
      reconnectPeriod: config.reconnectPeriod ?? 5000,
      protocolVersion: config.protocolVersion ?? 5,
    };

    if (config.username) options.username = config.username;
    if (config.password) options.password = config.password;

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(config.url, options);
      this.client = client;

      client.on('connect', () => {
        console.log('[MQTT] Connected to broker:', config.url);
        this.reconnectAttempts = 0;
        
        // Resubscribe to all topics
        this.handlers.forEach((_, topic) => {
          client.subscribe(topic, { qos: 1 });
        });
        
        resolve(client);
      });

      client.on('message', (topic: string, payload: Buffer, packet: any) => {
        this.handleMessage(topic, payload, packet);
      });

      client.on('error', (error) => {
        console.error('[MQTT] Connection error:', error);
        reject(error);
      });

      client.on('close', () => {
        console.log('[MQTT] Connection closed');
      });

      client.on('reconnect', () => {
        this.reconnectAttempts++;
        console.log(`[MQTT] Reconnecting... Attempt ${this.reconnectAttempts}`);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[MQTT] Max reconnection attempts reached');
          client.end();
        }
      });

      client.on('offline', () => {
        console.log('[MQTT] Client offline');
      });
    });
  }

  private handleMessage(topic: string, payload: Buffer, packet: any) {
    // Find matching handlers (including wildcard subscriptions)
    this.handlers.forEach((handlers, pattern) => {
      if (this.topicMatches(topic, pattern)) {
        handlers.forEach(handler => {
          try {
            handler(topic, payload, packet);
          } catch (error) {
            console.error(`[MQTT] Handler error for topic ${topic}:`, error);
          }
        });
      }
    });
  }

  private topicMatches(topic: string, pattern: string): boolean {
    if (pattern === '#') return true;
    if (pattern === topic) return true;
    
    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (patternParts[i] !== topicParts[i]) return false;
    }
    
    return topicParts.length === patternParts.length;
  }

  subscribe(topic: string, handler: MessageHandler): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)!.add(handler);

    if (this.client?.connected) {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`[MQTT] Subscribed to ${topic}`);
        }
      });
    }
  }

  unsubscribe(topic: string, handler?: MessageHandler): void {
    if (handler) {
      this.handlers.get(topic)?.delete(handler);
      if (this.handlers.get(topic)?.size === 0) {
        this.handlers.delete(topic);
      }
    } else {
      this.handlers.delete(topic);
    }

    if (!this.handlers.has(topic) && this.client?.connected) {
      this.client.unsubscribe(topic);
    }
  }

  publish(topic: string, message: any, options?: { qos?: 0 | 1 | 2; retain?: boolean }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      const payload = typeof message === 'string' 
        ? message 
        : JSON.stringify(message);

      this.client.publish(
        topic, 
        payload, 
        { qos: options?.qos ?? 1, retain: options?.retain ?? false },
        (err) => {
          if (err) {
            console.error(`[MQTT] Failed to publish to ${topic}:`, err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, () => {
          console.log('[MQTT] Disconnected');
          this.client = null;
          resolve();
        });
      });
    }
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  getClient(): MqttClient | null {
    return this.client;
  }
}

// Singleton instance
export const mqttManager = new MQTTConnectionManager();

// Export convenience functions
export const connectMQTT = (config: MQTTConfig) => mqttManager.connect(config);
export const subscribeMQTT = (topic: string, handler: MessageHandler) => mqttManager.subscribe(topic, handler);
export const unsubscribeMQTT = (topic: string, handler?: MessageHandler) => mqttManager.unsubscribe(topic, handler);
export const publishMQTT = (topic: string, message: any, options?: { qos?: 0 | 1 | 2; retain?: boolean }) => 
  mqttManager.publish(topic, message, options);
export const disconnectMQTT = () => mqttManager.disconnect();
export const isMQTTConnected = () => mqttManager.isConnected();
