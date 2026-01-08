import { AlertTriangle, Shield, Eye, Ban, CheckCircle, XCircle } from 'lucide-react';

interface FraudAlert {
  id: string;
  type: 'suspicious_pattern' | 'multiple_accounts' | 'payment_fraud' | 'location_mismatch';
  severity: 'high' | 'medium' | 'low';
  user: string;
  userType: 'driver' | 'passenger';
  description: string;
  timestamp: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  riskScore: number;
}

export default function FraudDetection() {
  const alerts: FraudAlert[] = [
    {
      id: 'FR001',
      type: 'suspicious_pattern',
      severity: 'high',
      user: 'James Wilson (P004)',
      userType: 'passenger',
      description: 'Multiple ride cancellations after pickup (8 in last hour)',
      timestamp: '15 mins ago',
      status: 'open',
      riskScore: 87
    },
    {
      id: 'FR002',
      type: 'payment_fraud',
      severity: 'high',
      user: 'Mike Johnson (P567)',
      userType: 'passenger',
      description: 'Failed payment attempts from multiple cards',
      timestamp: '1 hour ago',
      status: 'investigating',
      riskScore: 92
    },
    {
      id: 'FR003',
      type: 'multiple_accounts',
      severity: 'medium',
      user: 'Sarah Kim (D234)',
      userType: 'driver',
      description: 'Same device detected on multiple driver accounts',
      timestamp: '2 hours ago',
      status: 'investigating',
      riskScore: 76
    },
    {
      id: 'FR004',
      type: 'location_mismatch',
      severity: 'medium',
      user: 'Tom Anderson (P891)',
      userType: 'passenger',
      description: 'GPS location doesn\'t match pickup/dropoff addresses',
      timestamp: '3 hours ago',
      status: 'resolved',
      riskScore: 65
    },
    {
      id: 'FR005',
      type: 'suspicious_pattern',
      severity: 'low',
      user: 'Emily Davis (D445)',
      userType: 'driver',
      description: 'Unusual driving pattern detected',
      timestamp: '5 hours ago',
      status: 'false_positive',
      riskScore: 45
    },
  ];

  const stats = {
    totalAlerts: alerts.length,
    openAlerts: alerts.filter(a => a.status === 'open').length,
    investigating: alerts.filter(a => a.status === 'investigating').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-orange-100 text-orange-700 border-orange-200',
      low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    return colors[severity as keyof typeof colors] || 'bg-slate-100 text-slate-700';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-red-100 text-red-700',
      investigating: 'bg-blue-100 text-blue-700',
      resolved: 'bg-green-100 text-green-700',
      false_positive: 'bg-slate-100 text-slate-700',
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-yellow-600';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'suspicious_pattern':
        return <AlertTriangle className="w-5 h-5" />;
      case 'payment_fraud':
        return <XCircle className="w-5 h-5" />;
      case 'multiple_accounts':
        return <Shield className="w-5 h-5" />;
      case 'location_mismatch':
        return <Eye className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-2xl">{stats.totalAlerts}</h3>
          </div>
          <p className="text-slate-600">Total Alerts</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Eye className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-2xl">{stats.openAlerts}</h3>
          </div>
          <p className="text-slate-600">Open Alerts</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-2xl">{stats.investigating}</h3>
          </div>
          <p className="text-slate-600">Investigating</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-2xl">{stats.resolved}</h3>
          </div>
          <p className="text-slate-600">Resolved</p>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2>Fraud Alerts</h2>
          <p className="text-slate-600">Real-time suspicious activity detection</p>
        </div>

        <div className="divide-y divide-slate-200">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-6 ${
              alert.severity === 'high' ? 'bg-red-50/30' : ''
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                    {getTypeIcon(alert.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3>{alert.id}</h3>
                      <span className={`text-xs px-3 py-1 rounded-full ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()} RISK
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusBadge(alert.status)}`}>
                        {alert.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-600 mb-2">{alert.description}</p>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>User: <strong>{alert.user}</strong></span>
                      <span>•</span>
                      <span>Type: {alert.userType}</span>
                      <span>•</span>
                      <span>{alert.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-600 mb-1">Risk Score</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl ${getRiskColor(alert.riskScore)}`}>
                      {alert.riskScore}
                    </span>
                    <div className="w-16 bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          alert.riskScore >= 80 ? 'bg-red-600' :
                          alert.riskScore >= 60 ? 'bg-orange-600' :
                          'bg-yellow-600'
                        }`}
                        style={{ width: `${alert.riskScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {alert.status === 'open' && (
                <div className="flex gap-2 mt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                    Investigate
                  </button>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    Suspend User
                  </button>
                  <button className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm">
                    Mark as False Positive
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fraud Prevention Tips */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="mb-4">Active Fraud Prevention Measures</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Payment Verification', status: 'Active', count: '3,245 checks/day' },
            { title: 'Location Tracking', status: 'Active', count: '100% rides monitored' },
            { title: 'Pattern Analysis', status: 'Active', count: '24/7 monitoring' },
            { title: 'Device Fingerprinting', status: 'Active', count: '2,134 devices tracked' },
            { title: 'Account Verification', status: 'Active', count: '847 verifications pending' },
            { title: 'AI Risk Scoring', status: 'Active', count: 'Real-time analysis' },
          ].map((measure) => (
            <div key={measure.title} className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">{measure.title}</span>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  {measure.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{measure.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
