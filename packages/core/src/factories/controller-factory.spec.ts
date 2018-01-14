import { expect } from 'chai';

import { postHook, preHook } from '../factories';
import { Context, Middleware, Route } from '../interfaces';
import { Service, ServiceManager } from '../service-manager';
import { createEmptyContext } from '../testing';
import { ControllerFactory } from './controller-factory';

describe('ControllerFactory<T>', () => {

  interface ServiceInterface { foobar: () => Promise<any>; }
  const classPreMiddleware1: Middleware = (ctx, services) => ctx.state.preClass1 = { services };
  const classPreMiddleware2: Middleware = (ctx, services) => ctx.state.preClass2 = { services };
  const methodPreMiddleware1: Middleware = (ctx, services) => ctx.state.preMethod1 = { services };
  const methodPreMiddleware2: Middleware = (ctx, services) => ctx.state.preMethod2 = { services };
  const classPostMiddleware1: Middleware = (ctx, services) => ctx.state.postClass1 = { services };
  const classPostMiddleware2: Middleware = (ctx, services) => ctx.state.postClass2 = { services };
  const methodPostMiddleware1: Middleware = (ctx, services) => ctx.state.postMethod1 = { services };
  const methodPostMiddleware2: Middleware = (ctx, services) => ctx.state.postMethod2 = { services };

  @Service()
  @preHook(classPreMiddleware1)
  @preHook(classPreMiddleware2)
  @postHook(classPostMiddleware1)
  @postHook(classPostMiddleware2)
  class ServiceClass implements ServiceInterface {
    constructor() {}

    @preHook(methodPreMiddleware1)
    @preHook(methodPreMiddleware2)
    @postHook(methodPostMiddleware1)
    @postHook(methodPostMiddleware2)
    public async foobar(): Promise<any> { return 'Hello world'; }
  }

  class ConcreteControllerFactory extends ControllerFactory<ServiceInterface> {
    protected getRoutes(service: ServiceInterface): Route[] {
      return [
        {
          httpMethod: 'GET',
          middleware: async (context: Context) => service.foobar(),
          path: '/foobar',
          serviceMethodName: 'foobar',
          successStatus: 10000
        },
        {
          httpMethod: 'GET',
          middleware: async (context: Context) => service.foobar(),
          path: '/foobar',
          serviceMethodName: null,
          successStatus: 10000
        }
      ];
    }
  }
  let controllerFactory: ControllerFactory<ServiceInterface>;
  let services: ServiceManager;

  beforeEach(() => {
    services = new ServiceManager();
    controllerFactory = new ConcreteControllerFactory();
  });

  describe('when attachService(path: string, ServiceClass: Type<T>) is called', () => {

    it('should return a ReducedRoute array from the Route array of the getRoutes method.', async () => {
      const controller = controllerFactory.attachService('/my_path', ServiceClass);
      const routes = controller(services);

      expect(routes).to.be.an('array').and.to.have.lengthOf(2);

      const actual = routes[0];

      expect(actual.httpMethod).to.equal('GET');
      expect(actual.paths).to.deep.equal(['/my_path', '/foobar']);
      expect(actual.successStatus).to.equal(10000);

      expect(actual.middlewares).to.be.an('array').and.to.have.lengthOf(4 + 1 + 4);
      const ctx = createEmptyContext();

      // Pre-hooks
      actual.middlewares[0](ctx);
      expect(ctx.state.preClass1).to.deep.equal({ services });
      actual.middlewares[1](ctx);
      expect(ctx.state.preClass2).to.deep.equal({ services });
      actual.middlewares[2](ctx);
      expect(ctx.state.preMethod1).to.deep.equal({ services });
      actual.middlewares[3](ctx);
      expect(ctx.state.preMethod2).to.deep.equal({ services });

      // Service method
      await actual.middlewares[4](ctx);
      expect(ctx.result).to.equal('Hello world');

      // Post-hooks
      // Method post-hooks should be executed before class post-hooks.
      actual.middlewares[5](ctx);
      expect(ctx.state.postMethod1).to.deep.equal({ services });
      actual.middlewares[6](ctx);
      expect(ctx.state.postMethod2).to.deep.equal({ services });
      actual.middlewares[7](ctx);
      expect(ctx.state.postClass1).to.deep.equal({ services });
      actual.middlewares[8](ctx);
      expect(ctx.state.postClass2).to.deep.equal({ services });

      const actual2 = routes[1];
      expect(actual2.middlewares).to.be.an('array').and.to.have.lengthOf(4 + 1 + 0);
    });

  });

});