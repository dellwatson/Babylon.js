import { Nullable } from "../../types";
import { Observer, Observable } from "../../Misc/observable";
import { IDisposable } from "../../scene";
import { WebXRController } from './webXRController';
import { WebXRSessionManager, WebXRCamera } from '../../Legacy/legacy';

/**
 * XR input used to track XR inputs such as controllers/rays
 */
export class WebXRInput implements IDisposable {
    /**
     * XR controllers being tracked
     */
    public controllers: Array<WebXRController> = [];
    private _frameObserver: Nullable<Observer<any>>;
    private _sessionEndedObserver: Nullable<Observer<any>>;
    private _sessionInitObserver: Nullable<Observer<any>>;
    /**
     * Event when a controller has been connected/added
     */
    public onControllerAddedObservable = new Observable<WebXRController>();
    /**
     * Event when a controller has been removed/disconnected
     */
    public onControllerRemovedObservable = new Observable<WebXRController>();

    /**
     * Initializes the WebXRInput
     * @param baseExperience experience helper which the input should be created for
     */
    public constructor(
        /**
         * Base experience the input listens to
         */
        public xrSessionManager: WebXRSessionManager
    ) {
        // Remove controllers when exiting XR
        this._sessionEndedObserver = this.xrSessionManager.onXRSessionEnded.add(() => {
            this._addAndRemoveControllers([], this.controllers.map((c) => { return c.inputSource; }));
        });

        this._sessionInitObserver = this.xrSessionManager.onXRSessionInit.add((session) => {
            this._addAndRemoveControllers(session.inputSources, []);
            session.addEventListener("inputsourceschange", this._onInputSourcesChange);
        });

        this._frameObserver = this.xrSessionManager.onXRFrameObservable.add((frame) => {
            // Update controller pose info
            this.controllers.forEach((controller) => {
                controller.updateFromXRFrame(frame, this.xrSessionManager.referenceSpace);
            });
        });
    }

    private _onInputSourcesChange = (event: XRInputSourceChangeEvent) => {
        this._addAndRemoveControllers(event.added, event.removed);
    }

    private _addAndRemoveControllers(addInputs: Array<XRInputSource>, removeInputs: Array<XRInputSource>) {
        // Add controllers if they don't already exist
        let sources = this.controllers.map((c) => { return c.inputSource; });
        for (let input of addInputs) {
            if (sources.indexOf(input) === -1) {
                let controller = new WebXRController(this.xrSessionManager.scene, input);
                this.controllers.push(controller);
                this.onControllerAddedObservable.notifyObservers(controller);
            }
        }

        // Remove and dispose of controllers to be disposed
        let keepControllers: Array<WebXRController> = [];
        let removedControllers: Array<WebXRController> = [];
        this.controllers.forEach((c) => {
            if (removeInputs.indexOf(c.inputSource) === -1) {
                keepControllers.push(c);
            } else {
                removedControllers.push(c);
            }
        });
        this.controllers = keepControllers;
        removedControllers.forEach((c) => {
            this.onControllerRemovedObservable.notifyObservers(c);
            c.dispose();
        });

    }

    /**
     * Disposes of the object
     */
    public dispose() {
        this.controllers.forEach((c) => {
            c.dispose();
        });
        this.xrSessionManager.onXRFrameObservable.remove(this._frameObserver);
        this.xrSessionManager.onXRSessionInit.remove(this._sessionInitObserver);
        this.xrSessionManager.onXRSessionEnded.remove(this._sessionEndedObserver);
    }
}
