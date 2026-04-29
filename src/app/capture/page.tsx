import { StubPage } from '@/components/ui/StubPage';

export default function CaptureStub() {
  return (
    <StubPage
      title="拍照页"
      subtitle="调起设备相机或从相册选择，压缩到 1024px JPEG 80% 后上传。"
      plannedPhase="P2 (Day 1 端到端切片)"
      prdRef="§4.3 拍照流程详细规格"
    />
  );
}
