import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';

interface FunnelStep {
  id: string;
  order_index: number;
  step_type: string;
  content: { headline?: string; question?: string };
}

interface FunnelLead {
  id: string;
  answers: Record<string, string>;
  status: string;
  email?: string;
  phone?: string;
}

interface FunnelDropOffChartProps {
  steps: FunnelStep[];
  leads: FunnelLead[];
  funnelName: string;
}

export function FunnelDropOffChart({ steps, leads, funnelName }: FunnelDropOffChartProps) {
  const data = useMemo(() => {
    if (!steps.length || !leads.length) return [];

    // Get question steps in order (skip welcome, video, embed, thank_you as they're not "questions")
    const questionSteps = [...steps]
      .sort((a, b) => a.order_index - b.order_index)
      .filter(step => ['multi_choice', 'text_question', 'email_capture', 'phone_capture', 'opt_in'].includes(step.step_type));
    
    // Map step types to answer keys
    const stepToAnswerKey = (step: FunnelStep, index: number): string[] => {
      switch (step.step_type) {
        case 'multi_choice':
          return [`choice_${index + 1}`];
        case 'text_question':
          return [`question_${index + 1}`];
        case 'email_capture':
          return ['email'];
        case 'phone_capture':
          return ['phone'];
        case 'opt_in':
          return ['name', 'email', 'phone', 'opt_in'];
        default:
          return [];
      }
    };

    // Count leads that answered each question
    let questionIndex = 0;
    const stepCounts = questionSteps.map((step, i) => {
      questionIndex++;
      const answerKeys = stepToAnswerKey(step, questionIndex);
      
      const count = leads.filter(lead => {
        if (!lead.answers) return false;
        // Check if any of the expected keys exist in answers
        return answerKeys.some(key => lead.answers[key] !== undefined && lead.answers[key] !== '');
      }).length;
      
      return {
        name: getStepLabel(step, i),
        count,
        index: i,
      };
    });

    // Add "Started" as first point and "Completed" as last
    const totalStarted = leads.length;
    const completed = leads.filter(l => l.status === 'lead').length;
    
    const chartData = [
      { name: 'Started', count: totalStarted, index: -1 },
      ...stepCounts,
      { name: 'Completed', count: completed, index: stepCounts.length },
    ];

    // Calculate retention percentages
    return chartData.map((step, i) => {
      const retention = totalStarted > 0 ? Math.round((step.count / totalStarted) * 100) : 0;
      const prevCount = i === 0 ? totalStarted : chartData[i - 1].count;
      const dropOff = prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;
      
      return { ...step, retention, dropOff };
    });
  }, [steps, leads]);

  const totalStarted = leads.length;
  const totalCompleted = leads.filter(l => l.status === 'lead').length;
  const overallConversion = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;

  if (!data.length) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Select a funnel to view analytics</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Simple stats row */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{funnelName}</span>
        <div className="flex items-center gap-6">
          <span><strong>{totalStarted}</strong> started</span>
          <span><strong>{totalCompleted}</strong> completed</span>
          <span><strong>{overallConversion}%</strong> conversion</span>
        </div>
      </div>

      {/* Simple area chart */}
      <Card className="p-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="dropOffGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-2 shadow-lg text-sm">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground">{d.count} users ({d.retention}%)</p>
                      {d.dropOff > 0 && <p className="text-destructive">-{d.dropOff}% drop</p>}
                    </div>
                  );
                }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#dropOffGradient)"
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Simple step list */}
      <div className="space-y-1">
        {data.map((step, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 text-sm">
            <span className="text-muted-foreground">{step.name}</span>
            <div className="flex items-center gap-4">
              <span className="font-medium">{step.count}</span>
              {step.dropOff > 0 && (
                <span className="text-destructive text-xs">-{step.dropOff}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStepLabel(step: FunnelStep, index: number): string {
  const headline = step.content?.headline || step.content?.question;
  if (headline) {
    const text = headline.replace(/<[^>]*>/g, '').trim();
    return text.length > 25 ? text.slice(0, 25) + '...' : text;
  }
  
  const typeLabels: Record<string, string> = {
    multi_choice: `Question ${index + 1}`,
    text_question: `Question ${index + 1}`,
    email_capture: 'Email',
    phone_capture: 'Phone',
    opt_in: 'Opt-In Form',
  };
  
  return typeLabels[step.step_type] || `Step ${index + 1}`;
}
