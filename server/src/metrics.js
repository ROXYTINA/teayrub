// Publishes the custom metric the auto-scaling policy tracks:
//   CloudDraw/ConnectionsPerTask  (Average across tasks == "connections per task")
import { config } from './config.js';
import { stats } from './ws.js';

export function startMetrics() {
  let cw;
  const push = async () => {
    const { rooms, connections } = stats();
    console.log(JSON.stringify({ msg: 'stats', task: config.taskId, az: config.az, rooms, connections }));
    if (!config.cwMetrics) return;
    try {
      if (!cw) {
        const lib = await import('@aws-sdk/client-cloudwatch');
        cw = { client: new lib.CloudWatchClient({ region: config.region }), Put: lib.PutMetricDataCommand };
      }
      const Dimensions = [{ Name: 'Service', Value: config.serviceName }];
      await cw.client.send(new cw.Put({
        Namespace: 'CloudDraw',
        MetricData: [
          { MetricName: 'ConnectionsPerTask', Dimensions, Value: connections, Unit: 'Count' },
          { MetricName: 'RoomsPerTask', Dimensions, Value: rooms, Unit: 'Count' },
        ],
      }));
    } catch (e) { console.error('[metrics]', e.message); }
  };
  setInterval(push, 30_000).unref();
}
