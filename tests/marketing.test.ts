import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateTopServices,
  buildDemandBuckets,
  calculateAverageOrderValue,
  calculateRepeatRate,
  segmentWinBackCustomers,
  type MarketingBookingSnapshot
} from "../lib/marketing-core.ts";

test("repeat rate is zero when there are no active customers", () => {
  assert.equal(calculateRepeatRate(0, 3), 0);
});

test("repeat rate divides repeat customers by active customers", () => {
  assert.equal(calculateRepeatRate(8, 3), 0.375);
});

test("average order value is zero when there are no completed bookings", () => {
  assert.equal(calculateAverageOrderValue(1200, 0), 0);
});

test("average order value uses revenue divided by bookings", () => {
  assert.equal(calculateAverageOrderValue(2400, 6), 400);
});

test("win-back segmentation assigns 30/60/90 day buckets and flags at-risk customers", () => {
  const result = segmentWinBackCustomers(
    [
      {
        customerId: "c-1",
        customerName: "May",
        customerPhone: null,
        facebookName: null,
        customerCreatedAt: null,
        lastBookingAt: "2026-03-01T03:00:00.000Z",
        bookingCount: 4,
        totalSpend: 5000,
        petSummary: "Mochi"
      },
      {
        customerId: "c-2",
        customerName: "Ton",
        customerPhone: null,
        facebookName: null,
        customerCreatedAt: null,
        lastBookingAt: "2026-04-20T03:00:00.000Z",
        bookingCount: 1,
        totalSpend: 900,
        petSummary: "Bao"
      },
      {
        customerId: "c-3",
        customerName: "Pim",
        customerPhone: null,
        facebookName: null,
        customerCreatedAt: null,
        lastBookingAt: "2026-05-05T03:00:00.000Z",
        bookingCount: 2,
        totalSpend: 1800,
        petSummary: "Tofu"
      }
    ],
    "2026-06-08"
  );

  assert.deepEqual(
    result.map((row) => ({
      id: row.customer_id,
      segment: row.win_back_segment,
      atRisk: row.is_at_risk
    })),
    [
      { id: "c-1", segment: "90d", atRisk: true },
      { id: "c-2", segment: "30d", atRisk: false },
      { id: "c-3", segment: "30d", atRisk: false }
    ]
  );
});

test("top services aggregation sums quantity and revenue without duplicating bookings", () => {
  const bookings: MarketingBookingSnapshot[] = [
    {
      bookingId: "b-1",
      bookingType: "grooming",
      customerId: "c-1",
      customerName: "May",
      customerPhone: null,
      facebookName: null,
      customerCreatedAt: "2026-04-01T00:00:00.000Z",
      startAt: "2026-06-01T03:00:00.000Z",
      endAt: "2026-06-01T04:00:00.000Z",
      totalAmount: 700,
      roomName: null,
      pets: [
        { name: "Mochi", species: "cat", breed: "Persian" },
        { name: "Milk", species: "cat", breed: "Scottish Fold" }
      ],
      services: [
        { name: "Bath", qty: 2, lineTotal: 400 },
        { name: "Nail trim", qty: 1, lineTotal: 100 }
      ]
    },
    {
      bookingId: "b-2",
      bookingType: "grooming",
      customerId: "c-2",
      customerName: "Ton",
      customerPhone: null,
      facebookName: null,
      customerCreatedAt: "2026-04-11T00:00:00.000Z",
      startAt: "2026-06-02T03:00:00.000Z",
      endAt: "2026-06-02T04:00:00.000Z",
      totalAmount: 500,
      roomName: null,
      pets: [{ name: "Bao", species: "dog", breed: "Poodle" }],
      services: [{ name: "Bath", qty: 1, lineTotal: 300 }]
    }
  ];

  const result = aggregateTopServices(bookings);

  assert.deepEqual(result[0], {
    service_name: "Bath",
    quantity: 3,
    booking_count: 2,
    revenue: 700,
    revenue_share: 700 / 1200
  });
});

test("demand buckets count bookings by weekday and hour bucket", () => {
  const bookings: MarketingBookingSnapshot[] = [
    {
      bookingId: "b-1",
      bookingType: "grooming",
      customerId: "c-1",
      customerName: "May",
      customerPhone: null,
      facebookName: null,
      customerCreatedAt: null,
      startAt: "2026-06-01T03:00:00.000Z",
      endAt: "2026-06-01T04:00:00.000Z",
      totalAmount: 500,
      roomName: null,
      pets: [{ name: "Mochi", species: "cat", breed: "Persian" }],
      services: []
    },
    {
      bookingId: "b-2",
      bookingType: "hotel",
      customerId: "c-2",
      customerName: "Ton",
      customerPhone: null,
      facebookName: null,
      customerCreatedAt: null,
      startAt: "2026-06-01T09:00:00.000Z",
      endAt: "2026-06-02T03:00:00.000Z",
      totalAmount: 900,
      roomName: "A1",
      pets: [{ name: "Bao", species: "dog", breed: "Poodle" }],
      services: []
    }
  ];

  const result = buildDemandBuckets(bookings);
  const monday = result.weekday.find((item) => item.label === "Mon");
  const morning = result.hour.find((item) => item.label === "10:00-11:59");
  const afternoon = result.hour.find((item) => item.label === "16:00-17:59");

  assert.equal(monday?.booking_count, 2);
  assert.equal(morning?.booking_count, 1);
  assert.equal(afternoon?.booking_count, 1);
});
