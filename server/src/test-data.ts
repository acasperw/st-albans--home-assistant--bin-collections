import { ProcessedApiResponse } from './types';

export type TestScenario = 'tomorrow' | 'gap' | 'today';

/**
 * Generates mock test data for different scenarios:
 * - tomorrow (default): next collection is tomorrow
 * - gap: no collection tomorrow or today; first is in 3 days
 * - today: collection happening today (daysUntil 0)
 */
export function generateTestData(scenario: TestScenario = 'tomorrow'): ProcessedApiResponse {
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  const addDays = (n: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  };

  if (scenario === 'today') {
    const today = addDays(0);
    const nextWeek = addDays(7);
    return {
      collections: [
        {
          date: today.toISOString(),
          daysUntil: 0,
            services: [
              {
                serviceName: 'Food Waste',
                serviceType: 'food',
                taskType: 'Collection',
                last: addDays(-7).toISOString(),
                next: today.toISOString(),
                scheduleDescription: 'Weekly Collection'
              },
              {
                serviceName: 'Refuse',
                serviceType: 'refuse',
                taskType: 'Collection',
                last: addDays(-14).toISOString(),
                next: today.toISOString(),
                scheduleDescription: 'Fortnightly Collection'
              }
            ]
        },
        {
          date: nextWeek.toISOString(),
          daysUntil: 7,
          services: [
            {
              serviceName: 'Food Waste',
              serviceType: 'food',
              taskType: 'Collection',
              last: today.toISOString(),
              next: nextWeek.toISOString(),
              scheduleDescription: 'Weekly Collection'
            },
            {
              serviceName: 'Recycling',
              serviceType: 'recycling',
              taskType: 'Collection',
              last: addDays(-7).toISOString(),
              next: nextWeek.toISOString(),
              scheduleDescription: 'Fortnightly Collection'
            }
          ]
        }
      ]
    };
  }

  if (scenario === 'gap') {
    const inThree = addDays(3);
    const inTen = addDays(10);
    const inSeventeen = addDays(17);
    return {
      collections: [
        {
          date: inThree.toISOString(),
          daysUntil: 3,
          services: [
            {
              serviceName: 'Recycling',
              serviceType: 'recycling',
              taskType: 'Collection',
              last: addDays(-11).toISOString(),
              next: inThree.toISOString(),
              scheduleDescription: 'Fortnightly Collection'
            }
          ]
        },
        {
          date: inTen.toISOString(),
          daysUntil: 10,
          services: [
            {
              serviceName: 'Food Waste',
              serviceType: 'food',
              taskType: 'Collection',
              last: addDays(3).toISOString(),
              next: inTen.toISOString(),
              scheduleDescription: 'Weekly Collection'
            },
            {
              serviceName: 'Garden Waste',
              serviceType: 'garden',
              taskType: 'Collection',
              last: addDays(-4).toISOString(),
              next: inTen.toISOString(),
              scheduleDescription: 'Fortnightly Collection'
            }
          ]
        },
        {
          date: inSeventeen.toISOString(),
          daysUntil: 17,
          services: [
            {
              serviceName: 'Refuse',
              serviceType: 'refuse',
              taskType: 'Collection',
              last: addDays(3).toISOString(),
              next: inSeventeen.toISOString(),
              scheduleDescription: 'Fortnightly Collection'
            }
          ]
        }
      ]
    };
  }

  // default 'tomorrow'
  const tomorrow = addDays(1);
  const eight = addDays(8);
  const fifteen = addDays(15);
  return {
    collections: [
      {
        date: tomorrow.toISOString(),
        daysUntil: 1,
        services: [
          {
            serviceName: 'Food Waste',
            serviceType: 'food',
            taskType: 'Collection',
            last: addDays(-6).toISOString(),
            next: tomorrow.toISOString(),
            scheduleDescription: 'Weekly Collection'
          },
          {
            serviceName: 'Recycling',
            serviceType: 'recycling',
            taskType: 'Collection',
            last: addDays(-13).toISOString(),
            next: tomorrow.toISOString(),
            scheduleDescription: 'Fortnightly Collection'
          }
        ]
      },
      {
        date: eight.toISOString(),
        daysUntil: 8,
        services: [
          {
            serviceName: 'Food Waste',
            serviceType: 'food',
            taskType: 'Collection',
            last: tomorrow.toISOString(),
            next: eight.toISOString(),
            scheduleDescription: 'Weekly Collection'
          },
          {
            serviceName: 'Refuse',
            serviceType: 'refuse',
            taskType: 'Collection',
            last: addDays(-13).toISOString(),
            next: eight.toISOString(),
            scheduleDescription: 'Fortnightly Collection'
          }
        ]
      },
      {
        date: fifteen.toISOString(),
        daysUntil: 15,
        services: [
          {
            serviceName: 'Garden Waste',
            serviceType: 'garden',
            taskType: 'Collection',
            last: addDays(-13).toISOString(),
            next: fifteen.toISOString(),
            scheduleDescription: 'Fortnightly Collection'
          },
          {
            serviceName: 'Food Waste',
            serviceType: 'food',
            taskType: 'Collection',
            last: eight.toISOString(),
            next: fifteen.toISOString(),
            scheduleDescription: 'Weekly Collection'
          }
        ]
      }
    ]
  };
}
