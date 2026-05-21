import * as echarts from 'echarts/core'
import {
  BarChart, LineChart, PieChart, RadarChart, GaugeChart, HeatmapChart
} from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  PolarComponent, RadarComponent, VisualMapComponent, MarkLineComponent,
  MarkPointComponent, DatasetComponent, TransformComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LabelLayout, UniversalTransition } from 'echarts/features'

echarts.use([
  BarChart, LineChart, PieChart, RadarChart, GaugeChart, HeatmapChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  PolarComponent, RadarComponent, VisualMapComponent, MarkLineComponent,
  MarkPointComponent, DatasetComponent, TransformComponent,
  LabelLayout, UniversalTransition,
  CanvasRenderer
])

export * from 'echarts/core'
export default echarts
