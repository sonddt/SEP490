import { Link } from 'react-router-dom';

export default function CourtsGrid() {
  return (
    <div className=\
main-wrapper\>
      <section className=\breadcrumb
breadcrumb-list
mb-0\>
        <span className=\primary-right-round\></span>
        <div className=\container\>
          <h1 className=\text-white\>Venue Grid Without Sidebar</h1>
          <ul>
            <li><Link to=\/\>Home</Link></li>
            <li>Venue Grid Without Sidebar</li>
          </ul>
        </div>
      </section>

      <div className=\content\>
        <div className=\container\>
          {/* Sort By */}
          <div className=\row\>
            <div className=\col-lg-12\>
              <div className=\sortby-section\>
                <div className=\sorting-info\>
                  <div className=\row
d-flex
align-items-center\>
                    <div className=\col-xl-4
col-lg-3
col-sm-12
col-12\>
                      <div className=\count-search\>
                        <p><span>400</span> venues are listed</p>
                      </div>
                    </div>
                    <div className=\col-xl-8
col-lg-9
col-sm-12
col-12\>
                      <div className=\sortby-filter-group\>
                        <div className=\grid-listview\>
                          <ul className=\nav\>
                            <li>
                              <span>View as</span>
                            </li>
                            <li>
                              <Link to=\/courts\ className=\active\>
                                <img src=\/assets/img/icons/sort-01.svg\ alt=\Icon\ />
                              </Link>
                            </li>
                            <li>
                              <Link to=\/courts/list\>
                                <img src=\/assets/img/icons/sort-02.svg\ alt=\Icon\ />
                              </Link>
                            </li>
                            <li>
                              <Link to=\/courts/map\>
                                <img src=\/assets/img/icons/sort-03.svg\ alt=\Icon\ />
                              </Link>
                            </li>
                          </ul>
                        </div>
                        <div className=\sortbyset\>
                          <span className=\sortbytitle\>Sort By</span>
                          <div className=\sorting-select\>
                            <select className=\form-control
select\>
                              <option>Relevance</option>
                              <option>Price</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Listing Content - static convert from HTML */}
          <div className=\row
justify-content-center\>
            {/* Each card copied directly from template, images from /assets */}
            {/* Card 1 */}
            <div className=\col-lg-4
col-md-6\>
              <div className=\wrapper\>
                <div className=\listing-item
listing-item-grid\>
                  <div className=\listing-img\>
                    <Link to=\/venue-details\>
                      <img src=\/assets/img/venues/venues-01.jpg\ alt=\Venue\ />
                    </Link>
                    <div className=\fav-item-venues\>
                      <span className=\tag
tag-blue\>Featured</span>
                      <h5 className=\tag
tag-primary\><span>/hr</span></h5>
                    </div>
                  </div>
                  <div className=\listing-content\>
                    <div className=\list-reviews\>
                      <div className=\d-flex
align-items-center\>
                        <span className=\rating-bg\>4.2</span><span>300 Reviews</span>
                      </div>
                      <button type=\button\ className=\fav-icon\>
                        <i className=\feather-heart\></i>
                      </button>
                    </div>
                    <h3 className=\listing-title\>
                      <Link to=\/venue-details\>Sarah Sports Academy</Link>
                    </h3>
                    <div className=\listing-details-group\>
                      <p>Elevate your athletic journey at Sarah Sports Academy, where excellence meets opportunity.</p>
                      <ul>
                        <li>
                          <span>
                            <i className=\feather-map-pin\></i>Port Alsworth, AK
                          </span>
                        </li>
                        <li>
                          <span>
                            <i className=\feather-calendar\></i>Next availablity : <span className=\primary-text\>21 May 2023</span>
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className=\listing-button\>
                      <div className=\listing-venue-owner\>
                        <button type=\button\ className=\navigation\>
                          <img src=\/assets/img/profiles/avatar-01.jpg\ alt=\User\ />Mart Sublin
                        </button>
                      </div>
                      <Link to=\/venue-details\ className=\user-book-now\>
                        <span><i className=\feather-calendar
me-2\></i></span>Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TODO: copy remaining cards from HTML as static JSX, similar to above */}
          </div>

        </div>
      </div>
    </div>
  );
}

