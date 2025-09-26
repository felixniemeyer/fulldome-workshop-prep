import * as AvControls from 'av-controls'

export class ControlManager {
  private sphereSize = 0.5

  constructor(private loop: any) {
    const faderSpec = new AvControls.Controls.Fader.Spec(
      new AvControls.Controls.Base.Args(
        'Sphere Size',
        10, 10, 200, 40,
        '#4A90E2'
      ),
      0.5,  // initial value
      0.1,  // min
      2.0,  // max
      2     // decimal places
    )

    const faderReceiver = new AvControls.Controls.Fader.Receiver(
      faderSpec,
      (value: number) => {
        this.sphereSize = value
        this.loop.setSphereSize(value)
      }
    )

    const tabsSpec = new AvControls.Controls.Tabs.SpecWithoutControls(
      new AvControls.Controls.Base.Args(
        'Main Controls',
        10, 60, 400, 300,
        '#333333'
      ),
      'rendering'
    )

    const tabsReceiver = new AvControls.Controls.Tabs.Receiver(
      tabsSpec,
      {
        'rendering': faderReceiver
      }
    )

    const controlWindow = window.open('', 'controls', 'width=500,height=400')
    if (!controlWindow) {
      throw new Error('Failed to open control window')
    }

    new AvControls.Transports.Window.Receiver(
      controlWindow,
      'Domemaster Controls',
      tabsReceiver
    )
  }

  getSphereSize(): number {
    return this.sphereSize
  }
}