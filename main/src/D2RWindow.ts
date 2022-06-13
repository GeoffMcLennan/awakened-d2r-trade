import type { BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import { logger } from './logger'
import { config } from './config'
import { OverlayWindow as OW, AttachEvent } from 'electron-overlay-window'

interface D2RWindowClass {
  on: (event: 'active-change', listener: (isActive: boolean) => void) => this
}
class D2RWindowClass extends EventEmitter {
  private _isActive: boolean = false
  private _attachedWindow: BrowserWindow | undefined;

  get bounds () { return OW.bounds }

  get isActive () { return this._isActive }

  set isActive (active: boolean) {
    if (this.isActive !== active) {
      if (active) {
        logger.verbose('Is active', { source: 'd2r-window' })
      } else {
        logger.verbose('Not focused', { source: 'd2r-window' })
      }
      this._isActive = active
      this.emit('active-change', this._isActive)
    }
  }

  get attachedWindow() { return this._attachedWindow }

  get uiSidebarWidth () {
    // sidebar is 370px at 800x600
    const ratio = 370 / 600
    return Math.round(this.bounds.height * ratio)
  }

  attach (window: BrowserWindow) {
    logger.debug('Attached called')
    this._attachedWindow = window;
    OW.events.on('focus', () => { this.isActive = true })
    OW.events.on('blur', () => { this.isActive = false })

    OW.attachTo(window, config.get('windowTitle'))
  }

  onAttach (cb: (hasAccess: boolean | undefined) => void) {
    logger.debug('Attached to window');
    OW.events.on('attach', (e: AttachEvent) => {
      cb(e.hasAccess)
    })
  }
}

export const D2RWindow = new D2RWindowClass()
