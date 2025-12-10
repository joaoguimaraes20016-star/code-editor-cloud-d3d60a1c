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
  last_step_index?: number;
}

interface FunnelDropOffChartProps {
  steps: FunnelStep[];
  leads: FunnelLead[];
  funnelName: string;
}

export function FunnelDropOffChart({ steps, leads, funnelName }: FunnelDropOffChartProps) {
  const data = useMemo(() => {
    if (!steps.length || !leads.length) return [];

    // Sort ALL steps by order_index
    const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);

    // Track question index separately for answer key mapping
    let questionIndex = 0;
    
    // Build the answer key for each step
    const getAnswerKeysForStep = (step: FunnelStep, qIdx: number): string[] => {
      const idx = qIdx + 1; // 1-based index
      switch (step.step_type) {
        case 'multi_choice':
          return [`choice_${idx}`, `choice_${step.order_index + 1}`];
        case 'text_question':
          return [`question_${idx}`, `question_${step.order_index + 1}`];
        case 'email_capture':
          return ['email'];
        case 'phone_capture':
          return ['phone'];
        case 'opt_in':
          return ['opt_in', 'name'];
        default:
          return [];
      }
    };

    // Count leads that reached each step (ALL steps, not just questions)
    const stepCounts = sortedSteps.map((step, displayIndex) => {
      const isQuestionStep = ['multi_choice', 'text_question', 'email_capture', 'phone_capture', 'opt_in'].includes(step.step_type);
      const currentQuestionIndex = isQuestionStep ? questionIndex : -1;
      
      if (isQuestionStep) {
        questionIndex++;
      }
      
      const answerKeys = isQuestionStep ? getAnswerKeysForStep(step, currentQuestionIndex) : [];
      
      const count = leads.filter(lead => {
        // First step (Welcome) - all leads who started count
        if (step.order_index === 0) {
          return true;
        }
        
        // Method 1: Check if lead reached this step index or beyond via last_step_index
        const reachedByIndex = lead.last_step_index !== undefined && 
                               lead.last_step_index !== null &&
                               lead.last_step_index >= step.order_index;
        
        // Method 2: For question steps, check if answer exists
        const hasAnswer = isQuestionStep && lead.answers && answerKeys.some(key => {
          const value = lead.answers[key];
          return value !== undefined && value !== null && value !== '';
        });
        
        // Method 3: Check if they have ANY answers for later steps (means they passed this one)
        const hasLaterAnswers = lead.answers && Object.keys(lead.answers).length > 0 && 
          sortedSteps.slice(displayIndex + 1).some(laterStep => {
            const laterIsQuestion = ['multi_choice', 'text_question', 'email_capture', 'phone_capture', 'opt_in'].includes(laterStep.step_type);
            if (!laterIsQuestion) return false;
            
            // Check common answer keys
            const laterKeys = ['email', 'phone', 'name', 'opt_in'];
            for (let i = 1; i <= 10; i++) {
              laterKeys.push(`choice_${i}`, `question_${i}`);
            }
            return laterKeys.some(key => {
              const val = lead.answers[key];
              return val !== undefined && val !== null && val !== '';
            });
          });
        
        // Method 4: If lead has email/phone, they passed earlier steps
        const hasContactInfo = !!(lead.email || lead.phone);
        const isEarlyStep = step.order_index < sortedSteps.length - 2; // Not one of the last 2 steps
        
        return reachedByIndex || hasAnswer || hasLaterAnswers || (hasContactInfo && isEarlyStep);
      }).length;
      
      return {
        name: getStepLabel(step, displayIndex),
        fullName: getStepLabel(step, displayIndex),
        count,
        stepType: step.step_type,
        orderIndex: step.order_index,
      };
    });

    // Add "Started" as first point
    const totalStarted = leads.length;
    
    const chartData = [
      { name: 'Started', fullName: 'Started', count: totalStarted, stepType: 'start', orderIndex: -1 },
      ...stepCounts,
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
  const lastStep = data[data.length - 1];
  const totalCompleted = lastStep?.count || 0;
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
                tick={{ fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-2 shadow-lg text-sm">
                      <p className="font-medium">{d.fullName}</p>
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
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Simple step list */}
      <div className="space-y-1">
        {data.map((step, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step.fullName}</span>
            </div>
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
    return text.length > 20 ? text.slice(0, 20) + '...' : text;
  }
  
  const typeLabels: Record<string, string> = {
    welcome: 'Welcome',
    multi_choice: `Q${index + 1}`,
    text_question: `Q${index + 1}`,
    email_capture: 'Email',
    phone_capture: 'Phone',
    opt_in: 'Opt-In',
    video: 'Video',
    embed: 'Embed',
    thank_you: 'Thank You',
    divider: 'Divider',
  };
  
  return typeLabels[step.step_type] || `Step ${index + 1}`;
}
