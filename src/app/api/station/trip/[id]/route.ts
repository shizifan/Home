/**
 * GET /api/station/trip/:id
 * 获取出行报告。如果出行仍在进行中且已过最短等待时间，触发异步报告生成。
 */

import { NextResponse } from 'next/server';
import { getTripById } from '@/lib/db/repos';
import { processVisit } from '@/lib/orchestrate/processVisit';
import { processSchool } from '@/lib/orchestrate/processSchool';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trip = await getTripById(id);

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  // 如果仍是 traveling 状态，且至少过了 3 秒，执行报告生成
  if (trip.status === 'traveling') {
    const departedAt = new Date(trip.departed_at).getTime();
    const elapsed = Date.now() - departedAt;

    if (elapsed >= 3000) {
      try {
        if (trip.trip_type === 'visit') {
          const result = await processVisit({
            tripId: trip.id,
            companionId: trip.companion_id,
            purposeType: trip.purpose_type || 'meet_friend',
            purposeQuestion: trip.purpose_question,
          });
          return NextResponse.json({
            trip: {
              id: trip.id,
              trip_type: trip.trip_type,
              status: 'returned',
              departed_at: trip.departed_at,
              returned_at: new Date().toISOString(),
              report_narrative: result.reportNarrative,
              report_data: result.reportData,
            },
            destination_companion: {
              id: result.destinationCompanionId,
              name: result.destinationCompanionName,
            },
            rendered_home: result.renderedHome,
          });
        }

        if (trip.trip_type === 'school') {
          const result = await processSchool({
            tripId: trip.id,
            companionId: trip.companion_id,
            purposeType: trip.purpose_type || 'attend_class',
            purposeQuestion: trip.purpose_question,
          });
          return NextResponse.json({
            trip: {
              id: trip.id,
              trip_type: trip.trip_type,
              status: 'returned',
              departed_at: trip.departed_at,
              returned_at: new Date().toISOString(),
              report_narrative: result.reportNarrative,
              report_data: result.reportData,
            },
            question: result.question,
          });
        }

        // plaza 不在这里处理（通过专门的 plaza API）
      } catch (err) {
        console.error('process trip failed:', err);
        // 即使处理失败也返回 traveling 状态给前端重试
      }
    }

    // 仍在 traveling，返回等待状态
    return NextResponse.json({
      trip: {
        id: trip.id,
        trip_type: trip.trip_type,
        status: 'traveling',
        departed_at: trip.departed_at,
      },
      wait_seconds: Math.max(0, 3 - Math.floor(elapsed / 1000)),
    });
  }

  // 已返回，直接返回报告
  return NextResponse.json({
    trip: {
      id: trip.id,
      trip_type: trip.trip_type,
      status: trip.status,
      departed_at: trip.departed_at,
      returned_at: trip.returned_at,
      report_narrative: trip.report_narrative,
      report_data: trip.report_data,
    },
  });
}
