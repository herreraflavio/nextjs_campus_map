import ArcGISWrapper from "./components/ArcGISWrapper";
import Button from "@/app/components/button/Button";
import SketchTool from "./components/SketchTool";
export default function HomePage() {
  return (
    <>
      <Button />
      <SketchTool />
      <ArcGISWrapper />
    </>
  );
}
